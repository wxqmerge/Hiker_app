import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface AuthRequest extends Request {
  role?: 'admin';
}

const DEFAULT_AUTH_FAILURE_DELAY_MS = 1000;
const MAX_AUTH_FAILURE_DELAY_MS = 30000;

function getAdminKey() {
  return process.env.ADMIN_API_KEY || '';
}

function getAuthFailureDelayMs(): number {
  const raw = process.env.ADMIN_AUTH_FAILURE_DELAY_MS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_AUTH_FAILURE_DELAY_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_AUTH_FAILURE_DELAY_MS;
  return Math.min(Math.floor(parsed), MAX_AUTH_FAILURE_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keyDigest(key: string): Buffer {
  return crypto.createHash('sha256').update(key, 'utf8').digest();
}

function keysMatch(expected: string, provided: string): boolean {
  return crypto.timingSafeEqual(keyDigest(expected), keyDigest(provided));
}

function sendAuthError(res: Response, req: Request, status: number, message: string): void {
  console.warn(`[ADMIN_AUTH] ${status} - ${message} | IP: ${req.ip} | Path: ${req.path}`);
  res.status(status).json({
    success: false,
    error: { message },
  });
}

async function rejectAuth(
  res: Response,
  req: Request,
  status: number,
  message: string
): Promise<void> {
  const delayMs = getAuthFailureDelayMs();
  if (delayMs > 0) await sleep(delayMs);
  sendAuthError(res, req, status, message);
}

export async function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminKey = getAdminKey();

    if (!adminKey) {
      await rejectAuth(res, req, 403, 'ADMIN_API_KEY not configured');
      return;
    }

    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey !== 'string' || !apiKey) {
      await rejectAuth(res, req, 401, 'Missing API key');
      return;
    }

    if (!keysMatch(adminKey, apiKey)) {
      await rejectAuth(res, req, 401, 'Invalid API key');
      return;
    }
  } catch {
    sendAuthError(res, req, 401, 'Key validation error');
    return;
  }

  (req as AuthRequest).role = 'admin';
  next();
}
