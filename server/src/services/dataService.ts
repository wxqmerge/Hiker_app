import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { Trail, TrailDetail, ScheduleData, LookupData, TrailsData, TrailDetailsData } from '@shared/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../../exported_data');
export function getScheduleFile() {
  return `schedule_${process.env.SCHEDULE_NAME || 'default'}.json`;
}


console.log(`[DATA] Loading from: ${DATA_DIR}`);

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FULL_TO_ABBR: Record<string, string> = Object.fromEntries(MONTH_FULL.map((f, i) => [f, MONTH_ABBR[i]]));
const ABBR_SET = new Set(MONTH_ABBR);

function isMonthAbbr(key: string): boolean {
  return ABBR_SET.has(key);
}

function fullToAbbr(key: string): string | null {
  return FULL_TO_ABBR[key] || null;
}

// Normalize seasonal data: handle { availableMonths: [3,4,5] } → { Mar: 1, Apr: 1, May: 1 }
function normalizeSeasonal(seasonal: any): any {
  if (!seasonal || typeof seasonal !== 'object') return {};
  // Already has month-keyed numbers — pass through
  if (Object.keys(seasonal).some(k => ABBR_SET.has(k))) return seasonal;
  // Has availableMonths array — convert to month-keyed format
  if (Array.isArray(seasonal.availableMonths)) {
    const result: any = {};
    for (const m of seasonal.availableMonths) {
      const idx = typeof m === 'number' ? m : parseInt(m, 10);
      if (idx >= 1 && idx <= 12) {
        result[MONTH_ABBR[idx - 1]] = 1;
      }
    }
    if (seasonal.bestSeason) result.bestSeason = seasonal.bestSeason;
    return result;
  }
  return seasonal;
}

// Normalize schedule entry: ensure day is number, trail_id is string
function normalizeEntry(entry: any): any {
  const day = typeof entry.day === 'string' ? parseInt(entry.day, 10) : entry.day;
  if (isNaN(day)) return null;
  return {
    day,
    slot: entry.slot !== undefined ? (typeof entry.slot === 'string' ? parseInt(entry.slot, 10) : entry.slot) : 0,
    trail_id: String(entry.trail_id || ''),
    early_start: !!entry.early_start,
    leader: String(entry.leader || ''),
  };
}

// Normalize schedule: handle full month names, dict-based entries, string days
function normalizeSchedule(schedule: any): ScheduleData {
  if (!schedule || typeof schedule !== 'object') return {};
  const result: ScheduleData = {};

  for (const [key, value] of Object.entries(schedule)) {
    // Normalize month key: full name → abbreviation
    let monthKey = key;
    if (!isMonthAbbr(key)) {
      const abbr = fullToAbbr(key);
      if (!abbr) continue; // Unknown month, skip
      monthKey = abbr;
    }

    // Case 1: Array of entries (canonical format)
    if (Array.isArray(value)) {
      const entries = value.map(normalizeEntry).filter((e): e is NonNullable<typeof e> => e !== null);
      if (entries.length > 0) result[monthKey] = entries;
    }
    // Case 2: Dict of day→entry (import_schedule_xls.py format)
    else if (value && typeof value === 'object' && !('day' in value)) {
      const entries: any[] = [];
      for (const [dayStr, dayEntry] of Object.entries(value)) {
        const entry = normalizeEntry({ day: dayStr, ...dayEntry });
        if (entry) entries.push(entry);
      }
      entries.sort((a, b) => a.day - b.day);
      if (entries.length > 0) result[monthKey] = entries;
    }
  }

  return result;
}

let trails: Trail[] = [];
let trailDetails: TrailDetailsData = {};
let lookup: LookupData = { difficulties: [], parkingLevels: {} };
let schedule: ScheduleData = {};
let gpxIndex: Record<string, string> = {};
const GPX_UPLOAD_DIR = path.join(DATA_DIR, 'gpx');

export interface WriteHealth {
  lastWriteTime: string;
  lastWriteSuccess: boolean;
  lastError: string | null;
  lastErrorTime: string | null;
  consecutiveFailures: number;
}

const writeHealth: WriteHealth = {
  lastWriteTime: '',
  lastWriteSuccess: true,
  lastError: null,
  lastErrorTime: null,
  consecutiveFailures: 0,
};

export function getWriteHealth(): WriteHealth {
  return { ...writeHealth };
}

async function writeWithHealth(filePath: string, data: unknown): Promise<void> {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    writeHealth.lastWriteTime = new Date().toISOString();
    writeHealth.lastWriteSuccess = true;
    writeHealth.lastError = null;
    writeHealth.lastErrorTime = null;
    writeHealth.consecutiveFailures = 0;
  } catch (error) {
    writeHealth.lastWriteTime = new Date().toISOString();
    writeHealth.lastWriteSuccess = false;
    writeHealth.lastError = (error as Error).message;
    writeHealth.lastErrorTime = new Date().toISOString();
    writeHealth.consecutiveFailures++;
    throw error;
  }
}

async function loadFile<T>(filename: string, fallback: T): Promise<T> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[DATA] Could not load ${filename}:`, (error as Error).message);
    return fallback;
  }
}

export async function loadData(): Promise<void> {
  console.log('[DATA] Loading trail data...');
  console.log(`[DATA] Loading schedule from: ${getScheduleFile()}`);

  const trailsData: TrailsData = await loadFile('trails.json', { trails: [] });
  const rawTrails = Array.isArray(trailsData.trails) ? trailsData.trails : [];
  trails = rawTrails.map((t: any) => {
    const { gpxData: _, ...rest } = t;
    return { ...rest, seasonal: normalizeSeasonal(rest.seasonal) };
  });

  trailDetails = await loadFile('trail_details.json', {});
  lookup = await loadFile('lookup.json', { difficulties: [], parkingLevels: {} });
  schedule = normalizeSchedule(await loadFile(getScheduleFile(), {}));
  gpxIndex = await loadFile('gpx_index.json', {});

  // Attach gpxFile to each trail
  trails = trails.map(t => ({ ...t, gpxFile: gpxIndex[t.id] || undefined }));

  console.log(`[DATA] Loaded ${trails.length} trails, ${Object.keys(trailDetails).length} details, ${Object.keys(gpxIndex).length} GPX mappings`);
  console.log(`[DATA] Schedule months: ${Object.keys(schedule).join(', ') || '(none)'}`);
}

export function getTrails(): Trail[] {
  return [...trails];
}

export function getTrailById(id: string): Trail | undefined {
  return trails.find(t => t.id === id);
}

export function getTrailDetails(): TrailDetailsData {
  return { ...trailDetails };
}

export function getTrailDetailById(id: string): TrailDetail | undefined {
  return trailDetails[id];
}

export function getLookup(): LookupData {
  return lookup;
}

export function getSchedule(): ScheduleData {
  return { ...schedule };
}

export async function updateTrail(trail: Trail & { gpxData?: string }): Promise<void> {
  const trailIdx = trails.findIndex(t => t.id === trail.id);
  const { gpxData, ...trailWithoutGpx } = trail;
  const updatedTrail: Trail = { ...trailWithoutGpx };

  // Handle GPX data: save to file, set hasGpx, strip gpxData from trail object
  if (gpxData) {
    await fs.mkdir(GPX_UPLOAD_DIR, { recursive: true });
    const gpxFilePath = path.join(GPX_UPLOAD_DIR, `${trail.id}.gpx`);
    await fs.writeFile(gpxFilePath, gpxData, 'utf-8');
    gpxIndex[trail.id] = `${trail.id}.gpx`;
    updatedTrail.hasGpx = true;
  } else if (gpxData === '') {
    // Explicitly removing GPX
    delete gpxIndex[trail.id];
    updatedTrail.hasGpx = false;
  }

  // Handle GPX file upload: update gpxIndex when gpxFile is set
  if (updatedTrail.gpxFile) {
    gpxIndex[trail.id] = updatedTrail.gpxFile;
    updatedTrail.hasGpx = true;
  } else if (updatedTrail.gpxFile === '') {
    delete gpxIndex[trail.id];
    updatedTrail.hasGpx = false;
  }

  if (trailIdx >= 0) {
    trails[trailIdx] = updatedTrail;
  } else {
    trails.push(updatedTrail);
  }
  await writeWithHealth(path.join(DATA_DIR, 'trails.json'), { trails });
  await writeWithHealth(path.join(DATA_DIR, 'gpx_index.json'), gpxIndex);
}

export async function deleteTrail(id: string): Promise<void> {
  trails = trails.filter(t => t.id !== id);
  delete trailDetails[id];
  delete gpxIndex[id];
  // Remove uploaded GPX file if it exists
  const uploadedGpxPath = path.join(GPX_UPLOAD_DIR, `${id}.gpx`);
  try {
    await fs.unlink(uploadedGpxPath);
  } catch {
    // File may not exist
  }
  await writeWithHealth(path.join(DATA_DIR, 'trails.json'), { trails });
  await writeWithHealth(path.join(DATA_DIR, 'trail_details.json'), trailDetails);
  await writeWithHealth(path.join(DATA_DIR, 'gpx_index.json'), gpxIndex);
}

export async function updateTrailDetail(id: string, detail: TrailDetail): Promise<void> {
  trailDetails[id] = detail;
  await writeWithHealth(path.join(DATA_DIR, 'trail_details.json'), trailDetails);
}

const HISTORY_DIR = path.join(DATA_DIR, 'schedule_history');
const MAX_HISTORY = 10;

async function ensureHistoryDir(): Promise<void> {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
}

async function saveScheduleHistory(scheduleData: ScheduleData): Promise<void> {
  try {
    await ensureHistoryDir();
    const ts = Date.now();
    const filePath = path.join(HISTORY_DIR, `schedule_${ts}.json`);
    await fs.writeFile(filePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      schedule: scheduleData
    }, null, 2));
    // Prune old entries, keep last MAX_HISTORY
    const files = await fs.readdir(HISTORY_DIR);
    const historyFiles = files
      .filter(f => f.startsWith('schedule_') && f.endsWith('.json'))
      .sort();
    while (historyFiles.length > MAX_HISTORY) {
      await fs.unlink(path.join(HISTORY_DIR, historyFiles.shift()!));
    }
  } catch (error) {
    console.warn('[DATA] Could not save schedule history:', (error as Error).message);
  }
}

export async function getScheduleHistory(): Promise<Array<{ timestamp: string; entryCount: number; months: string[]; fileName: string }>> {
  try {
    const files = await fs.readdir(HISTORY_DIR);
    const entries: Array<{ timestamp: string; entryCount: number; months: string[]; fileName: string }> = [];
    for (const f of files.filter(f => f.startsWith('schedule_') && f.endsWith('.json'))) {
      try {
        const content = await fs.readFile(path.join(HISTORY_DIR, f), 'utf-8');
        const parsed = JSON.parse(content);
        let count = 0;
        const monthNames: string[] = [];
        if (parsed.schedule) {
          for (const [month, data] of Object.entries(parsed.schedule)) {
            if (Array.isArray(data) && data.length > 0) {
              count += data.length;
              monthNames.push(month);
            }
          }
        }
        entries.push({ timestamp: parsed.timestamp, entryCount: count, months: monthNames, fileName: f });
      } catch (err) {
        console.warn(`[DATA] Skipping corrupt history file ${f}:`, (err as Error).message);
      }
    }
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries;
  } catch {
    return [];
  }
}

export async function clearScheduleHistory(): Promise<void> {
  try {
    const files = await fs.readdir(HISTORY_DIR);
    for (const f of files.filter(f => f.startsWith('schedule_') && f.endsWith('.json'))) {
      await fs.unlink(path.join(HISTORY_DIR, f));
    }
  } catch (error) {
    console.warn('[DATA] Could not clear schedule history:', (error as Error).message);
  }
}

export async function restoreScheduleByTimestamp(timestamp: string): Promise<ScheduleData> {
  const files = await fs.readdir(HISTORY_DIR);
  for (const f of files) {
    if (!f.startsWith('schedule_') || !f.endsWith('.json')) continue;
    try {
      const content = await fs.readFile(path.join(HISTORY_DIR, f), 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.timestamp === timestamp && parsed.schedule) {
        schedule = parsed.schedule;
        await writeWithHealth(path.join(DATA_DIR, getScheduleFile()), schedule);
        return schedule;
      }
    } catch (err) {
        console.warn(`[DATA] Skipping corrupt history file ${f} during restore:`, (err as Error).message);
      }
  }
  throw new Error(`No history entry found for timestamp: ${timestamp}`);
}

export async function updateSchedule(newSchedule: ScheduleData): Promise<void> {
  // Archive current schedule before overwriting
  if (Object.keys(schedule).length > 0) {
    await saveScheduleHistory(schedule);
  }
  schedule = newSchedule;
  await writeWithHealth(path.join(DATA_DIR, getScheduleFile()), schedule);
}

export function getGpxIndex(): Record<string, string> {
  return { ...gpxIndex };
}

export function getGpxFileName(trailId: string): string | undefined {
  return gpxIndex[trailId];
}

export function getScheduleVersion(): string {
  try {
    const content = fsSync.readFileSync(path.join(DATA_DIR, getScheduleFile()), 'utf-8');
    return createHash('md5').update(content).digest('hex');
  } catch {
    return '';
  }
}

export function serverVersion(): string {
  try {
    const pkg = JSON.parse(fsSync.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

loadData().catch(err => {
  console.error('[DATA] Failed to load initial data:', err);
});
