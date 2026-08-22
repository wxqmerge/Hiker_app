import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { etagMatches } from './etagCompare.js';

export function generateEtag(data: unknown, length = 16): string {
  return createHash('md5').update(JSON.stringify(data)).digest('hex').substring(0, length);
}

export function sendWithEtag(req: Request, res: Response, data: unknown, maxAge = 300): void {
  const etag = `"${generateEtag(data)}"`;
  if (etagMatches(req.headers['if-none-match'] as string | undefined, etag)) {
    res.status(304).end();
  } else {
    res.set('ETag', etag).set('Cache-Control', `public, max-age=${maxAge}`).json(data);
  }
}
