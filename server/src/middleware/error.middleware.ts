import type { RequestHandler } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export function withErrorTag(tag: string) {
  return (fn: RequestHandler): RequestHandler => {
    return async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        console.error(`[${tag}] Error:`, error);
        const status = (error as any).status || 500;
        // 5xx internals (fs paths, driver messages) must not reach clients in
        // production; 4xx messages are part of the API contract (e.g. 412).
        const message = status >= 500 && isProduction
          ? 'Internal server error'
          : ((error as any).message || 'Internal server error');
        res.status(status).json({ success: false, error: { message } });
      }
    };
  };
}
