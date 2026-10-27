import { unauthorized } from '@vt/fn-common';
import { verifyAccessToken } from '../lib/tokens.js';

/** Requires a valid Bearer access token; sets `req.auth = { userId }`. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized('Missing bearer token'));
  try {
    const claims = verifyAccessToken(token, req.ctx.config.jwtSecret);
    req.auth = { userId: String(claims.sub) };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}
