import { Router } from 'express';
import { notFound, badRequest } from '@vt/fn-common';
import { rateLimit } from '../middleware/rate-limit.js';
import { lookupProduct } from '../lib/products.js';

export const productsRouter = Router();

productsRouter.get(
  '/products/:barcode',
  rateLimit({ windowMs: 60_000, max: 60, keyFn: (req) => req.auth?.userId }),
  async (req, res, next) => {
    try {
      const barcode = String(req.params.barcode).trim();
      if (!/^[0-9A-Za-z-]{4,32}$/.test(barcode)) throw badRequest('Invalid barcode');
      const product = await lookupProduct(req.ctx.repo, barcode, { fetch: req.ctx.fetch });
      if (!product) throw notFound('Product');
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);
