import { Router } from 'express';
import { createHash } from 'crypto';
import { getLookup } from '../services/dataService.js';

const router = Router();

router.get('/', (req, res) => {
  const data = getLookup();
  const etag = `"${createHash('md5').update(JSON.stringify(data)).digest('hex').substring(0, 16)}"`;
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.set('ETag', etag).set('Cache-Control', 'public, max-age=300').json(data);
});

export { router };
