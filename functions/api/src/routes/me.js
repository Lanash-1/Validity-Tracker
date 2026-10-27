import { Router } from 'express';
import { updateMeSchema } from '@vt/shared';
import { notFound, userFromRow } from '@vt/fn-common';
import { validate } from '../middleware/validate.js';

export const meRouter = Router();

meRouter.get('/me', async (req, res, next) => {
  try {
    const user = await req.ctx.repo.users.get(req.auth.userId);
    if (!user) throw notFound('User');
    res.json(userFromRow(user));
  } catch (err) {
    next(err);
  }
});

meRouter.patch('/me', validate(updateMeSchema), async (req, res, next) => {
  try {
    const patch = {};
    if (req.valid.body.name !== undefined) patch.name = req.valid.body.name;
    if (req.valid.body.timezone !== undefined) patch.timezone = req.valid.body.timezone;
    const user = Object.keys(patch).length
      ? await req.ctx.repo.users.update(req.auth.userId, patch)
      : await req.ctx.repo.users.get(req.auth.userId);
    if (!user) throw notFound('User');
    res.json(userFromRow(user));
  } catch (err) {
    next(err);
  }
});
