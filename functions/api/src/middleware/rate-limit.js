import { tooMany } from '@vt/fn-common';

/**
 * Minimal fixed-window limiter keyed by IP (per function instance). Good
 * enough to blunt brute force on auth and product lookups; not a DDoS shield.
 */
/** @param {{windowMs: number, max: number, keyFn?: (req: any) => string|undefined}} opts */
export function rateLimit({ windowMs, max, keyFn }) {
  const hits = new Map();
  return (req, _res, next) => {
    if (req.ctx?.config?.isDev) return next();
    const key = (keyFn ? keyFn(req) : null) ?? req.ip ?? 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    if (entry.count > max) return next(tooMany());
    next();
  };
}
