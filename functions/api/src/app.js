import express from 'express';
import cors from 'cors';
import { createCatalystRepo, createMemoryRepo, loadConfig } from '@vt/fn-common';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { spacesRouter } from './routes/spaces.js';
import { itemsRouter } from './routes/items.js';
import { productsRouter } from './routes/products.js';
import { devicesRouter, notificationsRouter } from './routes/devices.js';
import { createCatalystPhotoStore, createMemoryPhotoStore } from './lib/photos.js';

/**
 * @typedef {Object} RequestContext
 * @property {import('@vt/fn-common/src/repo/types.js').Repo} repo
 * @property {import('./lib/photos.js').PhotoStore} photos
 * @property {ReturnType<typeof loadConfig>} config
 * @property {typeof fetch} [fetch]
 * @property {any} [webSend]
 */

/**
 * Builds the Express app. `makeContext(req)` supplies storage per request:
 * Catalyst's SDK is initialised from the incoming request, while tests and
 * local dev pass a fixed in-memory context.
 *
 * @param {{ makeContext: (req: import('express').Request) => RequestContext | Promise<RequestContext>, config?: ReturnType<typeof loadConfig> }} opts
 */
export function buildApp(opts) {
  const config = opts.config ?? loadConfig();
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin / native requests have no Origin header.
        if (!origin || config.corsOrigins.includes(origin) || origin.startsWith('chrome-extension://'))
          return cb(null, true);
        cb(null, false);
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  // Catalyst serves Advanced I/O functions under /server/<function>/; accept
  // both that prefix and a bare /api/v1 so local dev and production match.
  app.use((req, _res, next) => {
    req.url = req.url.replace(/^\/server\/api(?=\/)/, '');
    next();
  });

  app.use(async (req, _res, next) => {
    try {
      req.ctx = await opts.makeContext(req);
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  const api = express.Router();
  api.use(authRouter);
  api.use(notificationsRouter.stack.length ? publicNotificationRoutes() : (_r, _s, n) => n());
  api.use(requireAuth);
  api.use(meRouter);
  api.use(spacesRouter);
  api.use(itemsRouter);
  api.use(productsRouter);
  api.use(devicesRouter);
  api.use(notificationsRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** The VAPID public key must be readable before sign-in (service worker setup). */
function publicNotificationRoutes() {
  const r = express.Router();
  r.get('/notifications/vapid-public-key', (req, res) => res.json({ publicKey: req.ctx.config.vapid.publicKey }));
  return r;
}

/** Production entry: Catalyst context per request. */
export function createApp() {
  const config = loadConfig();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const catalyst = require('zcatalyst-sdk-node');
  return buildApp({
    config,
    makeContext: (req) => {
      const capp = catalyst.initialize(/** @type {any} */ (req), { scope: 'admin' });
      return {
        repo: createCatalystRepo(capp),
        photos: createCatalystPhotoStore(capp, config.photoFolderId),
        config,
      };
    },
  });
}

/** Local dev / tests: one shared in-memory context. */
export function createMemoryApp(overrides = {}) {
  const config = overrides.config ?? loadConfig({ ...process.env, VT_DEV: '1', DEV_FAKE_GOOGLE: '1' });
  const ctx = {
    repo: overrides.repo ?? createMemoryRepo(),
    photos: overrides.photos ?? createMemoryPhotoStore(),
    config,
    fetch: overrides.fetch,
    webSend: overrides.webSend,
  };
  const app = buildApp({ config, makeContext: () => ctx });
  return Object.assign(app, { ctx });
}
