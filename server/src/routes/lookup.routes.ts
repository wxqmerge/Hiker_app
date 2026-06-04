import { Router } from 'express';
import { getLookup, getWriteHealth, serverVersion } from '../services/dataService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getLookup());
});

export { router };
