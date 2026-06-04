import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthRequest extends Request {
  role?: 'admin';
}

function getAdminKey() {
  return process.env.ADMIN_API_KEY || '';
}

export function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminKey = getAdminKey();

  if (!adminKey) {
    console.warn(`[ADMIN_AUTH] 403 - ADMIN_API_KEY not configured | IP: ${req.ip} | Path: ${req.path}`);
    res.status(403).json({
      success: false,
      error: { message: 'Admin API key not configured on server' },
    });
    return;
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    console.warn(`[ADMIN_AUTH] 401 - Missing API key | IP: ${req.ip} | Path: ${req.path}`);
    res.status(401).json({
      success: false,
      error: { message: 'Admin API key required' },
    });
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
        console.warn(`[ADMIN_AUTH] 401 - Invalid API key | IP: ${req.ip} | Path: ${req.path}`);
        res.status(401).json({
          success: false,
          error: { message: 'Invalid admin API key' },
        });
        return;
      }
    } else if (!crypto.timingSafeEqual(keyBuffer, providedBuffer)) {
      console.warn(`[ADMIN_AUTH] 401 - Invalid API key | IP: ${req.ip} | Path: ${req.path}`);
      res.status(401).json({
        success: false,
        error: { message: 'Invalid admin API key' },
      });
      return;
    }
  } catch (error) {
    console.warn(`[ADMIN_AUTH] 401 - Key validation error | IP: ${req.ip} | Path: ${req.path}`);
    res.status(401).json({
      success: false,
      error: { message: 'Invalid admin API key' },
    });
    return;
  }

  (req as AuthRequest).role = 'admin';
  next();
}
