import { Router } from 'express';
import multer from 'multer';
import { getSchedule, updateSchedule, updateScheduleMonth } from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

router.get('/', (_req, res) => {
  res.json(getSchedule());
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
