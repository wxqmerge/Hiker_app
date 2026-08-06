import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface AuthRequest extends Request {
  role?: 'admin';
}

function getAdminKey() {
  return process.env.ADMIN_API_KEY || '';
}

function sendAuthError(res: Response, req: Request, status: number, message: string): void {
  console.warn(`[ADMIN_AUTH] ${status} - ${message} | IP: ${req.ip} | Path: ${req.path}`);
  res.status(status).json({
    success: false,
    error: { message },
  });
}

export function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminKey = getAdminKey();

  if (!adminKey) {
    sendAuthError(res, req, 403, 'ADMIN_API_KEY not configured');
    return;
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    sendAuthError(res, req, 401, 'Missing API key');
    return;
  }

  try {
    const keyBuffer = Buffer.from(adminKey, 'utf-8');
    const providedBuffer = Buffer.from(apiKey, 'utf-8');

    if (keyBuffer.length !== providedBuffer.length) {
      const maxLen = Math.max(keyBuffer.length, providedBuffer.length);
      const paddedKey = Buffer.alloc(maxLen);
      const paddedProvided = Buffer.alloc(maxLen);
      keyBuffer.copy(paddedKey);
      providedBuffer.copy(paddedProvided);

      if (!crypto.timingSafeEqual(paddedKey, paddedProvided)) {
        sendAuthError(res, req, 401, 'Invalid API key');
        return;
      }
    } else if (!crypto.timingSafeEqual(keyBuffer, providedBuffer)) {
      sendAuthError(res, req, 401, 'Invalid API key');
      return;
    }
  } catch (error) {
    sendAuthError(res, req, 401, 'Key validation error');
    return;
  }

  (req as AuthRequest).role = 'admin';
  next();
}
