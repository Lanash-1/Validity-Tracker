import type { RequestContext } from '../src/app.js';

declare global {
  namespace Express {
    interface Request {
      ctx: RequestContext;
      auth: { userId: string };
      valid: { body?: any; query?: any; params?: any };
    }
  }
}
export {};
