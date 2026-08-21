import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import {
  getTrails,
  getTrailById,
  updateTrail,
  deleteTrail,
  getTrailDetails,
  getTrailDetailById,
  updateTrailDetail,
  getGpxFileName,
  getGpxIndex,
} from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import { withErrorTag } from '../middleware/error.middleware.js';
import { validateGpxContent } from '../utils/gpxValidation.js';
import {
  whitelistTrailFields,
  whitelistTrailDetailFields,
} from '../middleware/validation.middleware.js';
import { extractFirstCoordinateFromGpx } from '../utils/gpxCoord.js';
import { sendWithEtag } from '../utils/etag.js';
import { getCurrentDir } from '../utils/path.js';

const __dirname = getCurrentDir(import.meta.url);
const GPX_DIR = path.join(__dirname, '../../../GPX');
const GPX_UPLOAD_DIR = path.join(__dirname, '../../../exported_data/gpx');

const gpxUpload = multer({ dest: GPX_UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

async function resolveGpxPath(gpxFile: string): Promise<string | null> {
  const uploadPath = path.join(GPX_UPLOAD_DIR, gpxFile);
  const originalPath = path.join(GPX_DIR, gpxFile);
  try {
    await fs.access(uploadPath);
    return uploadPath;
  } catch { /* not in upload dir */ }
  try {
    await fs.access(originalPath);
    return originalPath;
  } catch { /* not in original dir either */ }
  return null;
}

const router = Router();

router.get('/', (req, res) => {
  sendWithEtag(req, res, { trails: getTrails() });
});

router.get('/details', (req, res) => {
  sendWithEtag(req, res, getTrailDetails());
});
 
router.put('/details/:id', requireAdminKey, withErrorTag('TRAILS')(async (req, res) => {
  const existing = getTrailDetailById(req.params.id);
  const whitelisted = whitelistTrailDetailFields(req.body);
  await updateTrailDetail(req.params.id, (existing ? { ...existing, ...whitelisted } : whitelisted) as any);
  res.json({ success: true, detail: getTrailDetailById(req.params.id) });
}));

router.put('/:id', requireAdminKey, withErrorTag('TRAILS')(async (req, res) => {
  const existing = getTrailById(req.params.id);
  const whitelisted = whitelistTrailFields(req.body);
  const trailData = existing ? { ...existing, ...whitelisted } : { ...whitelisted, id: req.params.id };
  await updateTrail(trailData as any);
  res.json({ success: true, trail: getTrailById(req.params.id) });
}));

router.get('/gpx/:id', async (req, res) => {
  const gpxFile = getGpxFileName(req.params.id);
  if (!gpxFile) {
    return res.status(404).json({ success: false, error: { message: 'GPX not found for this trail' } });
  }
  const gpxPath = await resolveGpxPath(gpxFile);
  if (!gpxPath) {
    return res.status(404).json({ success: false, error: { message: 'GPX file not found' } });
  }
  try {
    const content = await fs.readFile(gpxPath, 'utf-8');
    res.set('Content-Type', 'application/gpx+xml');
    res.set('Cache-Control', 'public, max-age=2592000');
    res.send(content);
  } catch {
    res.status(404).json({ success: false, error: { message: 'GPX file not found' } });
  }
});

router.post('/gpx/:id', requireAdminKey, gpxUpload.single('gpx'), withErrorTag('TRAILS')(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No GPX file uploaded' } });
  }
  const existing = getTrailById(req.params.id);
  if (!existing) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(404).json({ success: false, error: { message: 'Trail not found' } });
  }

  // Validate GPX file before saving
  let content;
  try {
    content = await fs.readFile(req.file.path, 'utf-8');
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: `Could not read uploaded GPX file: ${(err as Error).message}` } });
  }
  if (!validateGpxContent(content)) {
    await fs.unlink(req.file.path).catch(() => {});
    if (content.length < 100) {
      return res.status(400).json({ success: false, error: { message: `GPX file too small (${content.length} bytes) - likely corrupted` } });
    }
    if (!content.includes('<?xml') || !content.includes('<gpx')) {
      return res.status(400).json({ success: false, error: { message: 'Invalid GPX file - missing XML header or GPX root element' } });
    }
    return res.status(400).json({ success: false, error: { message: 'Invalid GPX file - no GPS coordinates found (needs trkpt, wpt, or rtept)' } });
  }

  // Ensure upload directory exists
  await fs.mkdir(GPX_UPLOAD_DIR, { recursive: true });

  // Save with trail name (sanitized), not the original filename
  const safeName = (existing.fullName || existing.name || req.params.id).replace(/[^a-zA-Z0-9]/g, '_');
  const gpxFileName = `${safeName}.gpx`;
  const destPath = path.join(GPX_UPLOAD_DIR, gpxFileName);
  try {
    await fs.copyFile(req.file.path, destPath);
    await fs.unlink(req.file.path);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ success: false, error: { message: `Could not save GPX file: ${(err as Error).message}` } });
  }

  // Update trail with gpxFile and extracted trailhead coordinates
  const whitelisted = whitelistTrailFields(req.body);
  const coord = extractFirstCoordinateFromGpx(content);
  const trailUpdates = coord
    ? { gpxFile: gpxFileName, hasGpx: true, trailHeadLat: coord.lat, trailHeadLon: coord.lon }
    : { gpxFile: gpxFileName, hasGpx: true };
  await updateTrail((existing ? { ...existing, ...whitelisted, ...trailUpdates } : { ...whitelisted, id: req.params.id, ...trailUpdates }) as any);
  res.json({ success: true, gpxFile: gpxFileName, trailHeadLat: coord?.lat ?? null, trailHeadLon: coord?.lon ?? null });
}));

router.post('/resync-gpx-coords', requireAdminKey, withErrorTag('TRAILS')(async (_req, res) => {
  const trails = getTrails();
  const gpxIndex = getGpxIndex();
  let updated = 0;
  const errors = [];

  for (const trail of trails) {
    if (!trail.hasGpx) continue;
    const gpxFile = gpxIndex[trail.id];
    if (!gpxFile) {
      errors.push(trail.id + ': no gpxFile');
      continue;
    }
    try {
      const gpxPath = await resolveGpxPath(gpxFile);
      if (!gpxPath) throw new Error('GPX file not found');
      const content = await fs.readFile(gpxPath, 'utf-8');
      const coord = extractFirstCoordinateFromGpx(content);
      if (coord) {
        await updateTrail({ ...trail, trailHeadLat: coord.lat, trailHeadLon: coord.lon });
        updated++;
      } else {
        errors.push(trail.id + ': no coords in GPX');
      }
    } catch (err) {
      errors.push(trail.id + ': ' + (err as Error).message);
    }
  }

  res.json({ success: true, updated, errors });
}));

router.delete('/:id', requireAdminKey, withErrorTag('TRAILS')(async (req, res) => {
  const existing = getTrailById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { message: 'Trail not found' } });
  }
  await deleteTrail(req.params.id);
  res.json({ success: true });
}));

export { router };
