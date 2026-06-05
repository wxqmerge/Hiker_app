import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
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

function parseXlsSheet(buffer: Buffer): { hikes: Array<{ month: string; day: number; hike: string }>; error?: string } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch (e) {
    return { hikes: [], error: `Unable to read file: ${e instanceof Error ? e.message : 'Not a valid Excel file'}` };
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return { hikes: [], error: 'File contains no worksheets' };
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

  if (rows.length === 0) {
    return { hikes: [], error: 'Worksheet is empty' };
  }

  const numCols = rows[0]?.length || 0;
  if (numCols === 0) {
    return { hikes: [], error: 'Worksheet contains no data columns' };
  }

  // Find header row with Month, Date, and Hike columns
  let headerRow = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const rowStrs = rows[i].map(c => safeStr(c).toLowerCase());
    if (rowStrs.includes('month') && rowStrs.includes('date') && rowStrs.includes('hike')) {
      headerRow = i;
      break;
    }
  }

  if (headerRow < 0) {
    const sample = rows[0].map(c => safeStr(c)).slice(0, 6).join(' | ');
    return { hikes: [], error: `Cannot find expected columns (Month, Date, Hike). First row: "${sample}"` };
  }

  // Find all Month/Date/Hike column triplets for multi-week layouts
  const allCols: Array<{ month: number; day: number; hike: number }> = [];
  const headerRowStrs = rows[headerRow].map(c => safeStr(c).toLowerCase());
  for (let c = 0; c < numCols - 1; c++) {
    if (headerRowStrs[c] === 'month') {
      for (let d = c + 1; d < numCols; d++) {
        if (headerRowStrs[d] === 'date') {
          for (let h = d + 1; h < numCols; h++) {
            if (headerRowStrs[h] === 'hike') {
              allCols.push({ month: c, day: d, hike: h });
              break;
            }
          }
          break;
        }
      }
    }
  }

  if (allCols.length === 0) {
    const headerSample = rows[headerRow].map(c => safeStr(c)).join(' | ');
    return { hikes: [], error: `Found header row but cannot locate Month/Date/Hike columns. Headers: "${headerSample}"` };
  }

  const hikes: Array<{ month: string; day: number; hike: string }> = [];
  let currentMonth = '';

  for (let i = headerRow + 1; i < rows.length; i++) {
    for (const { month: mCol, day: dCol, hike: hCol } of allCols) {
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

  return { hikes };
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

    const result = parseXlsSheet(req.file.buffer);
    if (result.error) {
      return res.status(400).json({ success: false, error: { message: result.error } });
    }
    if (result.hikes.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No valid hike data found in Excel file' } });
    }

    const trails = getTrails();
    const matched: Array<{ month: string; day: number; hike: string; trail_id: string; early_start: boolean }> = [];
    const unmatched: Array<{ month: string; day: number; hike: string }> = [];

    for (const h of result.hikes) {
      const earlyStart = h.hike.toLowerCase().includes('early start');
      const cleanHike = h.hike.replace(/\s*\(?\s*Early Start\s*\)?\s*/gi, '').trim();
      const m = matchHike(cleanHike, trails);
      if (m) {
        matched.push({ ...h, hike: cleanHike, trail_id: m.id, early_start: earlyStart });
      } else {
        unmatched.push(h);
      }
    }

    // Build schedule object grouped by month (full names to match client MONTH_NAMES)
    const scheduleByMonth: Record<string, Record<string, { trail_id: string; hike: string | null; early_start: boolean }>> = {};
    for (const entry of matched) {
      const fullMonth = MONTH_FULL[entry.month as keyof typeof MONTH_FULL] || entry.month;
      if (!scheduleByMonth[fullMonth]) scheduleByMonth[fullMonth] = {};
      scheduleByMonth[fullMonth][String(entry.day)] = { trail_id: entry.trail_id, hike: entry.hike || null, early_start: entry.early_start };
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
