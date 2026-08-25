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
  getGpxUploadFileName,
} from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import { withErrorTag } from '../middleware/error.middleware.js';
import { validateGpxContent, isSafeGpxFilename } from '../utils/gpxValidation.js';
import {
  whitelistTrailFields,
  whitelistTrailDetailFields,
} from '../middleware/validation.middleware.js';
import { extractFirstCoordinateFromGpx } from '../utils/gpxCoord.js';
import { extractDurationFromGpxContent } from '../utils/gpxDuration.js';
import { sendWithEtag } from '../utils/etag.js';
import { GPX_DIR, GPX_UPLOAD_DIR } from '../utils/paths.js';

const gpxUpload = multer({ dest: GPX_UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

async function resolveGpxPath(gpxFile: string): Promise<string | null> {
  if (!isSafeGpxFilename(gpxFile)) return null;
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
    res.set('Cache-Control', 'no-cache');
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
  const validationError = validateGpxContent(content);
  if (validationError) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ success: false, error: { message: validationError } });
  }

  // Ensure upload directory exists
  await fs.mkdir(GPX_UPLOAD_DIR, { recursive: true });

  // Save using the canonical trail-ID filename
  const gpxFileName = getGpxUploadFileName(req.params.id);
  const destPath = path.join(GPX_UPLOAD_DIR, gpxFileName);
  try {
    await fs.copyFile(req.file.path, destPath);
    await fs.unlink(req.file.path);
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ success: false, error: { message: `Could not save GPX file: ${(err as Error).message}` } });
  }

  const oldGpxFile = existing.gpxFile;
  if (oldGpxFile && oldGpxFile !== gpxFileName && isSafeGpxFilename(oldGpxFile)) {
    await fs.unlink(path.join(GPX_UPLOAD_DIR, oldGpxFile)).catch(() => {});
  }

  // Update trail with gpxFile and extracted trailhead coordinates
  const whitelisted = whitelistTrailFields(req.body);
  const coord = extractFirstCoordinateFromGpx(content);
  const duration = extractDurationFromGpxContent(content);
  const trailUpdates: any = {
    gpxFile: gpxFileName,
    hasGpx: true,
    ...(duration ? { durationMinutes: duration.minutes, duration: duration.formatted } : {})
  };
  if (coord) {
    trailUpdates.trailHeadLat = coord.lat;
    trailUpdates.trailHeadLon = coord.lon;
  }
  await updateTrail((existing ? { ...existing, ...whitelisted, ...trailUpdates } : { ...whitelisted, id: req.params.id, ...trailUpdates }) as any);
  res.json({ success: true, gpxFile: gpxFileName, trailHeadLat: coord?.lat ?? null, trailHeadLon: coord?.lon ?? null, duration: duration?.formatted ?? null, durationMinutes: duration?.minutes ?? null });
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
