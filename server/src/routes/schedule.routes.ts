import { Router } from 'express';
import multer from 'multer';
import { getSchedule, updateSchedule, getTrails, loadData, getScheduleHistory, restoreScheduleByTimestamp, clearScheduleHistory, getScheduleVersion } from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import { ScheduleEntrySchema, ScheduleSchema, RestoreTimestampSchema } from '../middleware/validation.middleware.js';
import { withErrorTag } from '../middleware/error.middleware.js';
import { validateXlsBuffer, runPythonScript, findPythonCmd } from '../utils/xlsImport.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../../..');

const router = Router();

router.get('/group', (_req, res) => {
  res.json({ 
    name: process.env.SCHEDULE_NAME || 'default',
    hikeDays: process.env.HIKE_DAYS || '3,5'
  });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

const QUARTER_MONTHS: Record<string, string[]> = {
  '1': ['Dec', 'Jan', 'Feb'],
  '2': ['Mar', 'Apr', 'May'],
  '3': ['Jun', 'Jul', 'Aug'],
  '4': ['Sep', 'Oct', 'Nov'],
};

function quarterToMonths(quarter: string): string[] {
  return quarter.replace('Q', '').split(',').map(q => QUARTER_MONTHS[q.charAt(0)] || []).flat();
}

router.post('/reload', requireAdminKey, withErrorTag('SCHEDULE')(async (req, res) => {
  await loadData();
  res.json({ success: true, message: 'Schedule and trail data reloaded from disk' });
}));

router.get('/', (req, res) => {
  const schedule = getSchedule();
  const version = getScheduleVersion();
  const ifNoneMatch = req.headers['if-none-match'];
  if (version && ifNoneMatch) {
    const clientEtag = ifNoneMatch.replace(/^"|"$/g, '');
    if (clientEtag === version) {
      return res.status(304).end();
    }
  }
  if (version) {
    res.set('ETag', version);
  }
  res.json(schedule);
});

router.put('/', requireAdminKey, withErrorTag('SCHEDULE')(async (req, res) => {
  const result = ScheduleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: { message: 'Invalid schedule data', details: result.error.issues } });
  }
  const entryCount = result.data ? Object.values(result.data).reduce((n: number, entries: any) => n + entries.length, 0) : 0;
  console.log('[SCHEDULE] PUT schedule -', entryCount, 'entries');
  const oldSchedule = getSchedule();
  const oldCount = Object.values(oldSchedule).reduce((n: number, entries: any) => n + (Array.isArray(entries) ? entries.length : 0), 0);
  console.log('[SCHEDULE] Previous:', oldCount, 'entries');
  await updateSchedule(result.data);
  const newVersion = getScheduleVersion();
  console.log('[SCHEDULE] Save complete, new version:', newVersion.substring(0, 8));
  res.json({ success: true, etag: newVersion });
}));

router.get('/history', withErrorTag('SCHEDULE')(async (_req, res) => {
  const history = await getScheduleHistory();
  res.json(history);
}));

router.post('/history/restore', requireAdminKey, withErrorTag('SCHEDULE')(async (req, res) => {
  const result = RestoreTimestampSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: { message: 'Invalid restore request' } });
  }
  const restored = await restoreScheduleByTimestamp(result.data.timestamp);
  res.json({ success: true, schedule: restored });
}));
 
router.post('/import-xls', requireAdminKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    if (!validateXlsBuffer(req.file.buffer)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid file format. Only XLS files are accepted.' } });
    }

    const tmpPath = path.join(PROJECT_ROOT, 'tmp_upload.xls');
    fs.writeFileSync(tmpPath, req.file.buffer);

    const trailsPath = path.join(PROJECT_ROOT, 'exported_data/trails.json');

    let pythonCmd: string;
    try {
      pythonCmd = await findPythonCmd();
    } catch {
      fs.unlinkSync(tmpPath);
      return res.status(500).json({
        success: false,
        error: { message: 'Python not found. Install Python 3 with pandas to import schedule data.' }
      });
    }

    try {
      const { stdout, stderr } = await runPythonScript(pythonCmd, path.join(PROJECT_ROOT, 'import_schedule_xls.py'), [
        tmpPath,
        trailsPath
      ]);

      fs.unlinkSync(tmpPath);

      if (stderr) {
        console.warn('[SCHEDULE] Python warnings:', stderr);
      }

      let result;
      try {
        result = JSON.parse(stdout);
      } catch {
        return res.status(500).json({
          success: false,
          error: { message: 'Failed to parse Python output. Check logs for details.' }
        });
      }

      if (result.error) {
        return res.status(400).json({ success: false, error: { message: result.error } });
      }

      if (!result.success || result.matched === 0) {
        return res.status(400).json({ success: false, error: { message: 'No valid hike data found in Excel file' } });
      }

      res.json(result);
    } catch (pyError: any) {
      fs.unlinkSync(tmpPath);
      const stderr = pyError.stderr || '';
      console.error('[SCHEDULE] Python script failed:', stderr || pyError.message);
      if (stderr.includes('No module named')) {
        return res.status(500).json({
          success: false,
          error: { message: 'Python dependency missing. Contact administrator.' }
        });
      }
      return res.status(500).json({
        success: false,
        error: { message: 'Python script failed. Contact administrator.' }
      });
    }
  } catch (error) {
    console.error('[SCHEDULE] Error importing XLS:', error);
    try {
      fs.unlinkSync(path.join(PROJECT_ROOT, 'tmp_upload.xls'));
    } catch { /* ignore */ }
    res.status(500).json({ success: false, error: { message: 'Failed to import Excel file' } });
  }
});

// Import trail data from Hike Data BaseM.xls
router.post('/import-trails-xls', requireAdminKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    if (!validateXlsBuffer(req.file.buffer)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid file format. Only XLS files are accepted.' } });
    }

    fs.writeFileSync(path.join(PROJECT_ROOT, 'Hike Data BaseM.xls'), req.file.buffer);

    let pythonCmd: string;
    try {
      pythonCmd = await findPythonCmd();
    } catch {
      return res.status(500).json({
        success: false,
        error: { message: 'Python not found. Install Python 3 with pandas and openpyxl to import trail data.' }
      });
    }

    try {
      const { stdout, stderr } = await runPythonScript(pythonCmd, path.join(PROJECT_ROOT, 'extract_trails_xls.py'), [
        path.join(PROJECT_ROOT, 'Hike Data BaseM.xls'),
        path.join(PROJECT_ROOT, 'exported_data')
      ]);
      if (stderr) {
        console.warn('[TRAILS] Python script warnings:', stderr);
      }

      const trailsData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'exported_data/trails.json'), 'utf-8'));
      const detailsData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'exported_data/trail_details.json'), 'utf-8'));
      const lookupData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'exported_data/lookup.json'), 'utf-8'));

      await loadData();
      res.json({
        success: true,
        message: `Imported ${trailsData.trails.length} trails with ${Object.keys(detailsData).length} details`,
        trailsCount: trailsData.trails.length,
        detailsCount: Object.keys(detailsData).length,
        difficulties: lookupData.difficulties?.length || 0,
        stdout: stdout,
      });
    } catch (pyError) {
      console.error('[TRAILS] Python script error:', pyError);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to run extraction script. Contact administrator.' }
      });
    }
  } catch (error) {
    console.error('[TRAILS] Error importing trails:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to import trail data' } });
  }
});

router.get('/ensure-writable', withErrorTag('SCHEDULE')(async (_req, res) => {
  const dataDir = path.join(PROJECT_ROOT, 'exported_data');
  const files = await fs.promises.readdir(dataDir);
  const results: Array<{ file: string; success: boolean; error?: string }> = [];

  for (const file of files) {
    if (file === 'schedule_history') continue;
    const filePath = path.join(dataDir, file);
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isDirectory) {
        await fs.promises.chmod(filePath, 0o666);
        results.push({ file, success: true });
      }
    } catch (error) {
      results.push({ file, success: false, error: (error as Error).message });
    }
  }

  res.json({ success: true, results });
}));

export { router };
