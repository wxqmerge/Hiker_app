import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { getSchedule, updateSchedule, updateScheduleMonth, getTrails } from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

const VALID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };

const SKIP_PATTERNS = [
  'alternate wednesday', 'alternate friday', 'alternate hike', 'alternate wed',
  'canceled', 'cancel', 'tbd', 'tba', 'wilderness 12max', 'note:', 'firm dates'
];

function safeStr(val: any): string {
  if (val == null || val === '') return '';
  return String(val).trim();
}

function isNa(val: any): boolean {
  return val == null || val === '' || (typeof val === 'string' && val.toLowerCase() === 'nan');
}

function isValidHikeName(hikeName: string): boolean {
  if (!hikeName) return false;
  const lower = hikeName.toLowerCase();
  for (const pat of SKIP_PATTERNS) {
    if (pat === 'early start' && lower.includes('early start')) {
      // "Early Start" in parentheses is OK, skip if it's the entire name
      if (lower === 'early start') return false;
      continue;
    }
    if (lower.includes(pat)) return false;
  }
  const alpha = hikeName.replace(/[^a-zA-Z]/g, '');
  return alpha.length >= 3;
}

function normalize(text: string): string {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchHike(hikeName: string, trails: any[]): { id: string; score: number } | null {
  const hikeNorm = normalize(hikeName);
  let hikeWords = hikeNorm.split(' ').filter(w => w.length > 1);

  // Split merged words
  const commonParts = ['gray', 'wolf', 'creek', 'cree', 'river', 'lake', 'peak',
    'hill', 'mount', 'mt', 'road', 'rd', 'trail', 'tr', 'valley',
    'pass', 'ridge', 'spit', 'beach', 'park', 'dam', 'fall'];
  const mergedWords: string[] = [];
  for (const word of hikeWords) {
    for (const part of commonParts) {
      if (word.includes(part) && word.length > part.length + 2) {
        const idx = word.indexOf(part);
        const before = word.substring(0, idx);
        const after = word.substring(idx);
        if (idx === 0) {
          const remaining = after.substring(part.length);
          if (remaining && remaining.length > 2 && !mergedWords.includes(remaining)) {
            mergedWords.push(remaining);
          }
          if (part.length > 2 && !mergedWords.includes(part)) {
            mergedWords.push(part);
          }
        } else {
          if (before.length > 2 && !mergedWords.includes(before)) mergedWords.push(before);
          if (after.length > 2 && !mergedWords.includes(after)) mergedWords.push(after);
        }
        break;
      }
    }
  }

  const extra = mergedWords.filter(w => !hikeWords.includes(w));
  const allWords = Array.from(new Set(hikeWords.concat(extra)));
  if (allWords.length === 0) return null;

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const t of trails) {
    const fullNorm = normalize(t.fullName || '');
    const nameNorm = normalize(t.name);
    const allText = fullNorm + ' ' + nameNorm;

    let score = 0;
    let wordsMatched = 0;
    for (const word of allWords) {
      if (allText.includes(word)) {
        score += word.length;
        wordsMatched++;
      }
    }
    if (wordsMatched === allWords.length && allWords.length > 2) score += 10;
    if (allText.includes(hikeNorm)) score += 20;
    for (const word of allWords) {
      if (word.length > 3 && t.name.toLowerCase().includes(word)) score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = t.id;
    }
  }

  return bestScore >= 4 && bestMatch ? { id: bestMatch, score: bestScore } : null;
}

function parseXlsSheet(buffer: Buffer): Array<{ month: string; day: number; hike: string }> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
  const numCols = rows[0]?.length || 0;

  // Find header row
  let headerRow = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].some(c => safeStr(c) === 'Month')) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return [];

  // Determine column layout
  let cols: Array<[number, number, number]>;
  if (numCols === 6) cols = [[0, 1, 2], [3, 4, 5]];
  else if (numCols === 9) cols = [[0, 1, 2], [4, 5, 6]];
  else if (numCols === 10) cols = [[0, 1, 2], [5, 6, 7]];
  else if (numCols === 11) cols = [[0, 1, 2], [6, 7, 8]];
  else if (numCols === 13) cols = [[0, 1, 2], [6, 7, 8]];
  else return [];

  const hikes: Array<{ month: string; day: number; hike: string }> = [];
  let currentMonth = '';

  for (let i = headerRow + 1; i < rows.length; i++) {
    for (const [mCol, dCol, hCol] of cols) {
      const monthVal = safeStr(rows[i]?.[mCol]);
      const dayVal = safeStr(rows[i]?.[dCol]);
      const hikeVal = safeStr(rows[i]?.[hCol]);

      if (!monthVal && !dayVal && !hikeVal) continue;

      if (VALID_MONTHS.includes(monthVal)) currentMonth = monthVal;
      if (!hikeVal || !currentMonth) continue;
      if (!isValidHikeName(hikeVal)) continue;

      const day = parseInt(dayVal, 10);
      if (!isNaN(day) && day > 0 && day <= 31) {
        hikes.push({ month: currentMonth, day, hike: hikeVal });
      }
    }
  }

  return hikes;
}

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

router.post('/import-xls', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const hikes = parseXlsSheet(req.file.buffer);
    if (hikes.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No valid hike data found in Excel file' } });
    }

    const trails = getTrails();
    const matched: Array<{ month: string; day: number; hike: string; trail_id: string }> = [];
    const unmatched: Array<{ month: string; day: number; hike: string }> = [];

    for (const h of hikes) {
      const m = matchHike(h.hike, trails);
      if (m) {
        matched.push({ ...h, trail_id: m.id });
      } else {
        unmatched.push(h);
      }
    }

    // Build schedule object grouped by month (full names to match client MONTH_NAMES)
    const scheduleByMonth: Record<string, Record<string, { trail_id: string; hike: string | null }>> = {};
    for (const entry of matched) {
      const fullMonth = MONTH_FULL[entry.month as keyof typeof MONTH_FULL] || entry.month;
      if (!scheduleByMonth[fullMonth]) scheduleByMonth[fullMonth] = {};
      scheduleByMonth[fullMonth][String(entry.day)] = { trail_id: entry.trail_id, hike: entry.hike || null };
    }

    res.json({
      success: true,
      schedule: scheduleByMonth,
      matched: matched.length,
      unmatched: unmatched.length,
      unmatchedDetails: unmatched.slice(0, 20),
      months: Object.keys(scheduleByMonth),
    });
  } catch (error) {
    console.error('[SCHEDULE] Error importing XLS:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to import Excel file' } });
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
