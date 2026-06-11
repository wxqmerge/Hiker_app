import { Router } from 'express';
import {
  getTrails,
  getTrailById,
  updateTrail,
  deleteTrail,
  getTrailDetails,
  getTrailDetailById,
  updateTrailDetail,
} from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import {
  whitelistTrailFields,
  whitelistTrailDetailFields,
} from '../middleware/validation.middleware.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ trails: getTrails() });
});

router.get('/details', (_req, res) => {
  res.json(getTrailDetails());
});

router.get('/details/:id', (req, res) => {
  const detail = getTrailDetailById(req.params.id);
  if (!detail) {
    return res.status(404).json({ success: false, error: { message: 'Trail detail not found' } });
  }
  res.json(detail);
});

router.put('/details/:id', requireAdminKey, async (req, res) => {
  try {
    const existing = getTrailDetailById(req.params.id);
    const whitelisted = whitelistTrailDetailFields(req.body);
    await updateTrailDetail(req.params.id, (existing ? { ...existing, ...whitelisted } : whitelisted) as any);
    res.json({ success: true, detail: getTrailDetailById(req.params.id) });
  } catch (error) {
    console.error('[TRAILS] Error updating trail detail:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update trail detail' } });
  }
});

router.get('/:id', (req, res) => {
  const trail = getTrailById(req.params.id);
  if (!trail) {
    return res.status(404).json({ success: false, error: { message: 'Trail not found' } });
  }
  res.json(trail);
});

router.put('/:id', requireAdminKey, async (req, res) => {
  try {
    const existing = getTrailById(req.params.id);
    const whitelisted = whitelistTrailFields(req.body);
    await updateTrail((existing ? { ...existing, ...whitelisted } : whitelisted) as any);
    res.json({ success: true, trail: getTrailById(req.params.id) });
  } catch (error) {
    console.error('[TRAILS] Error updating trail:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update trail' } });
  }
});

router.delete('/:id', requireAdminKey, async (req, res) => {
  try {
    const existing = getTrailById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: 'Trail not found' } });
    }
    await deleteTrail(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[TRAILS] Error deleting trail:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete trail' } });
  }
});

export { router };
