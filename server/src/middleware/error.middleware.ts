import type { RequestHandler } from 'express';

export function withErrorTag(tag: string) {
  return (fn: RequestHandler): RequestHandler => {
    return async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        console.error(`[${tag}] Error:`, error);
        const status = (error as any).status || 500;
        const message = (error as any).message || 'Internal server error';
        res.status(status).json({ success: false, error: { message } });
      }
    };
  };
}
