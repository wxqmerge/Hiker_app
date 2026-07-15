import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler(fn: RequestHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

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
