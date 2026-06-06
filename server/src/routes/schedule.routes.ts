import { Router } from 'express';
import multer from 'multer';
import { getSchedule, updateSchedule, getTrails, loadData, getScheduleHistory, restoreScheduleByTimestamp, clearScheduleHistory, getScheduleVersion } from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.join(__dirname, '../../..');

const router = Router();
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

async function findPythonCmd(): Promise<string> {
  for (const cmd of ['python', 'python3']) {
    try {
      await execFileAsync(cmd, ['--version']);
      return cmd;
    } catch { /* try next */ }
  }
  throw new Error('Python not found');
}

router.get('/', (req, res) => {
  const schedule = getSchedule();
  const version = getScheduleVersion();
  const ifNoneMatch = req.headers['if-none-match'];
  if (version && ifNoneMatch && ifNoneMatch === version) {
    return res.status(304).end();
  }
  if (version) {
    res.set('ETag', version);
  }
  res.json(schedule);
});

router.put('/', requireAdminKey, async (req, res) => {
  try {
    const entryCount = Object.values(req.body).reduce((n: number, entries: any) => n + (Array.isArray(entries) ? entries.length : 0), 0);
    console.log('[SCHEDULE] PUT schedule -', entryCount, 'entries');
    const oldSchedule = getSchedule();
    const oldCount = Object.values(oldSchedule).reduce((n: number, entries: any) => n + (Array.isArray(entries) ? entries.length : 0), 0);
    console.log('[SCHEDULE] Previous:', oldCount, 'entries');
    await updateSchedule(req.body);
    const newVersion = getScheduleVersion();
    console.log('[SCHEDULE] Save complete, new version:', newVersion.substring(0, 8));
    res.json({ success: true, etag: newVersion });
  } catch (error) {
    console.error('[SCHEDULE] Error updating schedule:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update schedule' } });
  }
});

router.get('/history', async (_req, res) => {
  try {
    const history = await getScheduleHistory();
    res.json(history);
  } catch (error) {
    console.error('[SCHEDULE] Error getting history:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to get schedule history' } });
  }
});

router.post('/history/restore', requireAdminKey, async (req, res) => {
  try {
    const { timestamp } = req.body;
    if (!timestamp) {
      return res.status(400).json({ success: false, error: { message: 'timestamp is required' } });
    }
    const restored = await restoreScheduleByTimestamp(timestamp);
    res.json({ success: true, schedule: restored });
  } catch (error) {
    console.error('[SCHEDULE] Error restoring schedule:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(404).json({ success: false, error: { message: msg } });
  }
});

router.delete('/history', requireAdminKey, async (_req, res) => {
  try {
    await clearScheduleHistory();
    res.json({ success: true });
  } catch (error) {
    console.error('[SCHEDULE] Error clearing history:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to clear schedule history' } });
  }
});

router.get('/report', (req, res) => {
  const quarter = (Array.isArray(req.query.quarter) ? req.query.quarter[0] : req.query.quarter) as string;
  if (!quarter || typeof quarter !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'quarter query parameter required' } });
  }

  const schedule = getSchedule();
  const months = quarterToMonths(quarter);

  let report = `Schedule Report: ${quarter}\n`;
  report += '='.repeat(40) + '\n\n';

  for (const month of months) {
    const entries = schedule[month];
    report += `--- ${month} ---\n`;
    if (!entries || entries.length === 0) {
      report += '(no hikes)\n';
    } else {
      for (const entry of entries) {
        report += `  Day ${entry.day}: ${entry.hike} [${entry.trail_id}]\n`;
      }
    }
    report += '\n';
  }

  res.type('text/plain').send(report);
});

router.get('/download', (req, res) => {
  const quarter = (Array.isArray(req.query.quarter) ? req.query.quarter[0] : req.query.quarter) as string;
  if (!quarter || typeof quarter !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'quarter query parameter required' } });
  }

  const schedule = getSchedule();
  const months = quarterToMonths(quarter);

  let tsv = '';
  for (const month of months) {
    const entries = schedule[month];
    if (entries && entries.length > 0) {
      tsv += `${month}\n`;
      for (const entry of entries) {
        tsv += `${entry.day}\t${entry.hike}\t${entry.trail_id}\n`;
      }
      tsv += '\n';
    }
  }

  res.setHeader('Content-Disposition', `attachment; filename="${quarter}_schedule.tsv"`);
  res.type('text/tab-separated-values').send(tsv);
});

router.post('/import-xls', requireAdminKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    // Save uploaded file temporarily
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
      const { stdout, stderr } = await execFileAsync(pythonCmd, [
        path.join(PROJECT_ROOT, 'import_schedule_xls.py'),
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
      const stdout = pyError.stdout || '';
      console.error('[SCHEDULE] Python script failed:', stderr || pyError.message);
      if (stderr.includes('No module named')) {
        return res.status(500).json({
          success: false,
          error: { message: `Python dependency missing: ${stderr.split('\n').pop()}. Run: sudo apt install python3-pandas` }
        });
      }
      return res.status(500).json({
        success: false,
        error: { message: `Python script error: ${stderr || stdout || pyError.message}` }
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

    // Restrict to exact filename
    if (req.file.originalname !== 'Hike Data BaseM.xls') {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid filename: "${req.file.originalname}". Only "Hike Data BaseM.xls" is accepted.` }
      });
    }

    // Save file to expected location
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
      const { stdout, stderr } = await execFileAsync(pythonCmd, [
        path.join(PROJECT_ROOT, 'extract_trails_xls.py'),
        path.join(PROJECT_ROOT, 'Hike Data BaseM.xls'),
        path.join(PROJECT_ROOT, 'exported_data')
      ]);
      if (stderr) {
        console.warn('[TRAILS] Python script warnings:', stderr);
      }

      // Read the output JSON files
      const trailsData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'exported_data/trails.json'), 'utf-8'));
      const detailsData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'exported_data/trail_details.json'), 'utf-8'));
      const lookupData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'exported_data/lookup.json'), 'utf-8'));

      // Update in-memory data by reloading dataService
      // (module-level state, so we need to trigger a reload)
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
        error: { message: `Failed to run extraction script: ${pyError instanceof Error ? pyError.message : 'Unknown error'}` }
      });
    } finally {
      // Clean up the uploaded file (keep it for future use)
      // Don't delete - it's the source of truth
    }
  } catch (error) {
    console.error('[TRAILS] Error importing trails:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to import trail data' } });
  }
});

router.post('/upload', requireAdminKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);

    let currentMonth = '';
    const parsed: Record<string, Array<{ day: number; hike: string; trail_id: string }>> = {};

    for (const line of lines) {
      const tabs = line.split('\t');
      if (tabs.length >= 3) {
        const day = parseInt(tabs[0], 10);
        const hike = tabs[1];
        const trail_id = tabs[2];
        if (!isNaN(day) && hike && trail_id) {
          if (!parsed[currentMonth]) parsed[currentMonth] = [];
          parsed[currentMonth].push({ day, hike, trail_id });
        }
      } else if (!line.includes('\t')) {
        const possibleMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (possibleMonths.includes(line)) {
          currentMonth = line;
        }
      }
    }

    if (!Object.keys(parsed).length) {
      return res.status(400).json({ success: false, error: { message: 'No valid schedule data found in TSV' } });
    }

    const schedule = getSchedule();
    for (const [month, entries] of Object.entries(parsed)) {
      schedule[month] = entries;
    }

    await updateSchedule(schedule);

    res.json({
      success: true,
      message: `Updated ${Object.keys(parsed).length} month(s): ${Object.keys(parsed).join(', ')}`,
      months: Object.keys(parsed),
    });
  } catch (error) {
    console.error('[SCHEDULE] Error uploading schedule:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to upload schedule' } });
  }
});

export { router };
