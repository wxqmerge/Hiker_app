import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import multer from 'multer';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import { loadData } from '../services/dataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../../exported_data');
const TMP_DIR = path.join(__dirname, '../../../tmp');

// Ensure tmp directory exists
await fs.mkdir(TMP_DIR, { recursive: true });

const router = Router();
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 200 * 1024 * 1024 } });

const JSON_FILES = ['trails.json', 'trail_details.json', 'lookup.json', 'schedule.json', 'gpx_index.json'];

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
  const historyDir = path.join(DATA_DIR, 'schedule_history');
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

router.get('/export-zip', async (_req, res) => {
  try {
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
  } catch (error) {
    console.error('[DATA] Export ZIP error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to export data' } });
  }
});

router.post('/import-zip', requireAdminKey, upload.single('zip'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No ZIP file uploaded' } });
    }

    const zipPath = req.file.path;
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    let imported = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.replace(/^\.\//, '');
      const target = path.join(DATA_DIR, name);

      // Security: only allow .json and .gpx files within exported_data
      const ext = path.extname(name);
      if (ext !== '.json' && ext !== '.gpx') continue;

      // Ensure target is within DATA_DIR
      const realTarget = path.resolve(target);
      if (!realTarget.startsWith(path.resolve(DATA_DIR))) {
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
          continue;
        }
      }
      // Validate GPX files
      if (ext === '.gpx') {
        const gpxContent = content.toString('utf-8');
        if (gpxContent.length < 100) {
          console.warn(`[DATA] Skipping corrupted GPX (too small): ${name}`);
          continue;
        }
        if (!gpxContent.includes('<?xml') || !gpxContent.includes('<gpx')) {
          console.warn(`[DATA] Skipping invalid GPX (bad XML): ${name}`);
          continue;
        }
        if (!gpxContent.includes('<trkpt') && !gpxContent.includes('<wpt') && !gpxContent.includes('<rtept')) {
          console.warn(`[DATA] Skipping GPX with no coordinates: ${name}`);
          continue;
        }
      }

      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
      imported++;
    }

    // Clean up temp file
    await fs.unlink(zipPath).catch(() => {});

    // Reload in-memory data from disk
    await loadData();

    res.json({ success: true, imported });
  } catch (error) {
    console.error('[DATA] Import ZIP error:', error);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ success: false, error: { message: 'Failed to import data' } });
  }
});

export { router };
