import { Router } from 'express';
import multer from 'multer';
import { getSchedule, updateSchedule, updateScheduleMonth, getTrails, loadData } from '../services/dataService.js';
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

router.get('/', (_req, res) => {
  res.json(getSchedule());
});

router.put('/', requireAdminKey, async (req, res) => {
  try {
    await updateSchedule(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('[SCHEDULE] Error updating schedule:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update schedule' } });
  }
});

router.get('/report', (req, res) => {
  const quarter = req.query.quarter as string;
  if (!quarter) {
    return res.status(400).json({ success: false, error: { message: 'quarter query parameter required' } });
  }

  const schedule = getSchedule();
  const months = quarter.replace('Q', '').split(',').map((q: string) => {
    const num = q.charAt(0);
    if (num === '1') return ['Dec', 'Jan', 'Feb'];
    if (num === '2') return ['Mar', 'Apr', 'May'];
    if (num === '3') return ['Jun', 'Jul', 'Aug'];
    if (num === '4') return ['Sep', 'Oct', 'Nov'];
    return [];
  }).flat();

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
  const quarter = req.query.quarter as string;
  if (!quarter) {
    return res.status(400).json({ success: false, error: { message: 'quarter query parameter required' } });
  }

  const schedule = getSchedule();
  const months = quarter.replace('Q', '').split(',').map((q: string) => {
    const num = q.charAt(0);
    if (num === '1') return ['Dec', 'Jan', 'Feb'];
    if (num === '2') return ['Mar', 'Apr', 'May'];
    if (num === '3') return ['Jun', 'Jul', 'Aug'];
    if (num === '4') return ['Sep', 'Oct', 'Nov'];
    return [];
  }).flat();

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

    // Check if Python is available
    let pythonCmd = 'python';
    try {
      await execFileAsync(pythonCmd, ['--version']);
    } catch {
      pythonCmd = 'python3';
      try {
        await execFileAsync(pythonCmd, ['--version']);
      } catch {
        fs.unlinkSync(tmpPath);
        return res.status(500).json({
          success: false,
          error: { message: 'Python not found. Install Python 3 with pandas to import schedule data.' }
        });
      }
    }

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
  } catch (error) {
    console.error('[SCHEDULE] Error importing XLS:', error);
    // Clean up temp file on error
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

    try {
      // Check if Python is available
      let pythonCmd = 'python';
      try {
        await execFileAsync(pythonCmd, ['--version']);
      } catch {
        pythonCmd = 'python3';
        try {
          await execFileAsync(pythonCmd, ['--version']);
        } catch {
          return res.status(500).json({
            success: false,
            error: { message: 'Python not found. Install Python 3 with pandas and openpyxl to import trail data.' }
          });
        }
      }

      const { stdout, stderr } = await execFileAsync(pythonCmd, [path.join(PROJECT_ROOT, 'extract_trails_xls.py')]);
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
