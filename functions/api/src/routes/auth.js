import { Router } from 'express';
import { googleSignInSchema, refreshSchema } from '@vt/shared';
import { sha256, unauthorized, userFromRow } from '@vt/fn-common';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import { issueTokenPair } from '../lib/tokens.js';

export const authRouter = Router();

authRouter.use(rateLimit({ windowMs: 60_000, max: 30 }));

authRouter.post('/auth/google', validate(googleSignInSchema), async (req, res, next) => {
  try {
    const { repo, config } = req.ctx;
    const input = req.valid.body;
    const g = await verifyGoogleIdToken(input.idToken, config);

    let user = await repo.users.findByGoogleSub(g.sub);
    if (!user) user = await repo.users.findByEmail(g.email);
    const nowIso = new Date().toISOString();
    if (!user) {
      user = await repo.users.insert({
        email: g.email,
        name: g.name,
        avatar_url: g.picture,
        google_sub: g.sub,
        timezone: input.timezone ?? 'UTC',
        last_login_at: nowIso,
      });
      const personal = await repo.spaces.insert({
        name: 'Personal',
        type: 'personal',
        icon: '🏠',
        owner_user_id: user.ROWID,
        invite_code: null,
      });
      await repo.members.add(String(personal.ROWID), String(user.ROWID));
    } else {
      const patch = { last_login_at: nowIso, google_sub: g.sub };
      if (g.picture && g.picture !== user.avatar_url) patch.avatar_url = g.picture;
      if (!user.timezone && input.timezone) patch.timezone = input.timezone;
      user = await repo.users.update(user.ROWID, patch);
    }

    const tokens = await issueTokenPair(repo, user, config.jwtSecret, {
      platform: input.platform,
      deviceLabel: input.deviceLabel,
    });
    res.status(200).json({ ...tokens, user: userFromRow(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/auth/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { repo, config } = req.ctx;
    const stored = await repo.refreshTokens.findByHash(sha256(req.valid.body.refreshToken));
    if (!stored || stored.revoked_at) throw unauthorized('Refresh token is invalid');
    if (Date.parse(stored.expires_at) < Date.now()) throw unauthorized('Refresh token has expired');
    const user = await repo.users.get(String(stored.user_id));
    if (!user) throw unauthorized('User no longer exists');
    await repo.refreshTokens.revoke(stored.ROWID);
    const tokens = await issueTokenPair(repo, user, config.jwtSecret, {
      platform: stored.platform,
      deviceLabel: stored.device_label,
    });
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/auth/logout', requireAuth, async (req, res, next) => {
  try {
    const { repo } = req.ctx;
    const token = req.body?.refreshToken;
    if (typeof token === 'string' && token) {
      const stored = await repo.refreshTokens.findByHash(sha256(token));
      if (stored && String(stored.user_id) === req.auth.userId) await repo.refreshTokens.revoke(stored.ROWID);
    } else {
      await repo.refreshTokens.revokeAllForUser(req.auth.userId);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
