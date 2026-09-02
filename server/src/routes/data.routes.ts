import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import multer from 'multer';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import { withErrorTag } from '../middleware/error.middleware.js';
import { validateGpxContent } from '../utils/gpxValidation.js';
import { loadData, getScheduleFile, getTrails, getGpxIndex, setGpxIndex } from '../services/dataService.js';
import { DATA_DIR, GPX_UPLOAD_DIR, TMP_DIR, HISTORY_DIR } from '../utils/paths.js';

// Ensure tmp directory exists
await fs.mkdir(TMP_DIR, { recursive: true });

const router = Router();
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 200 * 1024 * 1024 } });

const JSON_FILES = ['trails.json', 'trail_details.json', 'lookup.json', getScheduleFile(), 'gpx_index.json'];

async function collectFiles(): Promise<Map<string, Buffer>> {
  const files = new Map();
  for (const name of JSON_FILES) {
    const fp = path.join(DATA_DIR, name);
    try {
      const content = await fs.readFile(fp, 'utf-8');
      files.set(name, Buffer.from(content, 'utf-8'));
    } catch {
      // skip missing files
    }
  }
  // schedule_history/*.json
  const historyDir = HISTORY_DIR;
  try {
    const entries = await fs.readdir(historyDir);
    for (const name of entries.filter(n => n.endsWith('.json'))) {
      const fp = path.join(historyDir, name);
      const content = await fs.readFile(fp, 'utf-8');
      files.set(`schedule_history/${name}`, Buffer.from(content, 'utf-8'));
    }
  } catch {
    // directory may not exist
  }
  // gpx/*.gpx
  const gpxDir = path.join(DATA_DIR, 'gpx');
  try {
    const entries = await fs.readdir(gpxDir);
    for (const name of entries.filter(n => n.endsWith('.gpx'))) {
      const fp = path.join(gpxDir, name);
      const content = await fs.readFile(fp);
      files.set(`gpx/${name}`, content);
    }
  } catch {
    // directory may not exist
  }
  return files;
}

router.get('/export-zip', withErrorTag('DATA')(async (_req, res) => {
  const files = await collectFiles();
  const zip = new AdmZip();
  for (const [name, content] of files) {
    zip.addFile(name, content);
  }
  const buffer = zip.toBuffer();
  const date = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="hiker-data-${date}.zip"`);
  res.send(buffer);
}));

router.post('/import-zip', requireAdminKey, upload.single('zip'), withErrorTag('DATA')(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No ZIP file uploaded' } });
  }

  const zipPath = req.file.path;
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Collect schedule files from ZIP and check for conflicts
  const expectedScheduleName = process.env.SCHEDULE_NAME || 'default';
  const zipScheduleEntries = new Map();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/^\.\//, '');
    const scheduleMatch = name.match(/^schedule_(.+)\.json$/);
    if (scheduleMatch) {
      zipScheduleEntries.set(name, scheduleMatch[1]);
    }
  }
  // Determine which schedule files to skip (name mismatch)
  const skipScheduleFiles = new Set();
  const skippedScheduleNames: string[] = [];
  for (const [name, zipScheduleName] of zipScheduleEntries) {
    if (zipScheduleName !== expectedScheduleName) {
      skipScheduleFiles.add(name);
      skippedScheduleNames.push(`'${zipScheduleName}'`);
    }
  }

  let imported = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/^\.\//, '');

    // Skip schedule files that don't match this instance
    if (skipScheduleFiles.has(name)) {
      console.warn(`[DATA] Skipping schedule file for different instance: ${name}`);
      continue;
    }

    const target = path.join(DATA_DIR, name);

    // Security: only allow .json and .gpx files within exported_data
    const ext = path.extname(name);
    if (ext !== '.json' && ext !== '.gpx') continue;

    // Ensure target is within DATA_DIR (avoid sibling-prefix bypasses)
    const dataRoot = path.resolve(DATA_DIR);
    const realTarget = path.resolve(target);
    if (realTarget !== dataRoot && !realTarget.startsWith(dataRoot + path.sep)) {
      console.warn(`[DATA] Skipping unsafe path: ${name}`);
      continue;
    }

    const content = entry.getData();
    // Validate JSON files
    if (ext === '.json') {
      try {
        JSON.parse(content.toString('utf-8'));
      } catch {
        console.warn(`[DATA] Skipping invalid JSON: ${name}`);
        errors.push(`${name}: invalid JSON`);
        continue;
      }
    }
    // Validate GPX files
    if (ext === '.gpx') {
      const gpxContent = content.toString('utf-8');
      const gpxError = validateGpxContent(gpxContent);
      if (gpxError) {
        console.warn(`[DATA] Skipping invalid GPX: ${name} - ${gpxError}`);
        errors.push(`${name}: ${gpxError}`);
        continue;
      }
    }

    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
      imported++;
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[DATA] Failed to write ${name}: ${msg}`);
      errors.push(`${name}: ${msg}`);
    }
  }

  // Clean up temp file
  await fs.unlink(zipPath).catch(() => {});

  // Reload in-memory data from disk
  await loadData();

  // Reconcile gpx_index: remove entries for trail IDs that don't exist, delete orphaned files
  const trailIds = new Set(getTrails().map(t => t.id));
  const gpxIndex = getGpxIndex();
  let reconciled = 0;
  for (const [trailId, gpxFile] of Object.entries(gpxIndex)) {
    if (!trailIds.has(trailId)) {
      reconciled++;
      try {
        await fs.unlink(path.join(GPX_UPLOAD_DIR, gpxFile));
      } catch {
        // File may not exist
      }
    }
  }
  // Rewrite gpx_index with only valid entries
  const validGpxIndex: Record<string, string> = {};
  for (const [trailId, gpxFile] of Object.entries(gpxIndex)) {
    if (trailIds.has(trailId)) {
      validGpxIndex[trailId] = gpxFile;
    }
  }
  await fs.writeFile(path.join(DATA_DIR, 'gpx_index.json'), JSON.stringify(validGpxIndex, null, 2));
  // Sync in-memory index so it matches the cleaned file on disk
  setGpxIndex(validGpxIndex);

  // Check for orphaned GPX files on disk that have no index entry
  const orphanedGpx: string[] = [];
  try {
    const gpxFilesOnDisk = await fs.readdir(GPX_UPLOAD_DIR);
    const indexedFiles = new Set(Object.values(validGpxIndex));
    for (const f of gpxFilesOnDisk) {
      if (f.endsWith('.gpx') && !indexedFiles.has(f)) {
        orphanedGpx.push(f);
      }
    }
  } catch {
    // gpx dir may not exist
  }

  const result: any = { success: errors.length === 0, imported, reconciled };
  if (skippedScheduleNames.length > 0) {
    result.skippedSchedules = skippedScheduleNames;
  }
  if (orphanedGpx.length > 0) {
    result.orphanedGpx = orphanedGpx;
  }
  if (errors.length > 0) {
    result.errors = errors;
  }
  res.json(result);
}));

export { router };
