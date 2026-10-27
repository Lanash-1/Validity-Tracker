import { Router } from 'express';
import { registerDeviceSchema } from '@vt/shared';
import { deviceFromRow, notFound, sendToDevices, sha256 } from '@vt/fn-common';
import { validate } from '../middleware/validate.js';

export const devicesRouter = Router();

devicesRouter.post('/devices', validate(registerDeviceSchema), async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const input = req.valid.body;
    const token = input.platform === 'android' ? input.token : JSON.stringify(input.subscription);
    const row = await repo.devices.upsert({
      user_id: req.auth.userId,
      platform: input.platform,
      token,
      token_key: sha256(token),
      label: input.label ?? null,
    });
    res.status(201).json(deviceFromRow(row));
  } catch (err) {
    next(err);
  }
});

devicesRouter.get('/devices', async (req, res, next) => {
  try {
    const rows = await req.ctx.repo.devices.listForUser(req.auth.userId);
    res.json(rows.map(deviceFromRow));
  } catch (err) {
    next(err);
  }
});

devicesRouter.delete('/devices/:id', async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const row = await repo.devices.get(req.params.id);
    if (!row || String(row.user_id) !== req.auth.userId) throw notFound('Device');
    await repo.devices.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export const notificationsRouter = Router();

notificationsRouter.get('/notifications/vapid-public-key', (req, res) => {
  res.json({ publicKey: req.ctx.config.vapid.publicKey });
});

notificationsRouter.post('/notifications/test', async (req, res, next) => {
  try {
    const { repo, config } = req.ctx;
    const devices = await repo.devices.listForUser(req.auth.userId);
    const result = await sendToDevices(
      devices,
      { title: 'Validity Tracker', body: 'Test notification: reminders are working.', data: { kind: 'test' } },
      { vapid: config.vapid, expoAccessToken: config.expoAccessToken, fetch: req.ctx.fetch, webSend: req.ctx.webSend },
    );
    for (const id of result.dead) await repo.devices.remove(id);
    res.json({ sent: result.sent });
  } catch (err) {
    next(err);
  }
});
