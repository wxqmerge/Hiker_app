import { Router } from 'express';
import { getLookup } from '../services/dataService.js';
import { sendWithEtag } from '../utils/etag.js';

const router = Router();

router.get('/', (req, res) => {
  sendWithEtag(req, res, getLookup());
});

export { router };
