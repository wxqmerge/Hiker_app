import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Trail, TrailDetail, ScheduleData, LookupData, TrailsData, TrailDetailsData } from '@shared/types/index.js';
import { MONTH_ABBR, resolveScheduleMonthKey } from '../utils/monthUtils.js';
import { generateEtag } from '../utils/etag.js';
import { isSafeGpxFilename } from '../utils/gpxValidation.js';
import { extractDurationFromGpxContent } from '../utils/gpxDuration.js';
import { DATA_DIR, HISTORY_DIR, GPX_DIR } from '../utils/paths.js';
import { getCurrentDir } from '../utils/path.js';

// Cache for GPX durations
const durationCache = new Map<string, { minutes: number; formatted: string }>();

async function extractDurationFromGpx(gpxPath: string): Promise<{ minutes: number; formatted: string } | null> {
  if (durationCache.has(gpxPath)) {
    return durationCache.get(gpxPath)!;
  }
  
  try {
    const content = await fs.readFile(gpxPath, 'utf-8');
    const result = extractDurationFromGpxContent(content);
    if (result) {
      durationCache.set(gpxPath, result);
    }
    return result;
  } catch (error) {
    console.warn(`[DATA] Could not extract duration from ${gpxPath}:`, (error as Error).message);
    return null;
  }
}

export function getScheduleFile() {
  return `schedule_${process.env.SCHEDULE_NAME || 'default'}.json`;
}


console.log(`[DATA] Loading from: ${DATA_DIR}`);

const ABBR_SET = new Set(MONTH_ABBR);

// Normalize seasonal data: handle { availableMonths: [3,4,5] } → { Mar: 1, Apr: 1, May: 1 }
function normalizeSeasonal(seasonal: any): any {
  if (!seasonal || typeof seasonal !== 'object') return {};
  // Already has month-keyed numbers — pass through
  if (Object.keys(seasonal).some(k => ABBR_SET.has(k as (typeof MONTH_ABBR)[number]))) return seasonal;
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
    early_start: entry.early_start === true ? -30 : entry.early_start === false || entry.early_start == null ? 0 : Number(entry.early_start) || 0,
    leader: String(entry.leader || ''),
  };
}

// Normalize schedule: handle full month names, dict-based entries, string days
function normalizeSchedule(schedule: any): ScheduleData {
  if (!schedule || typeof schedule !== 'object') return {};
  const result: ScheduleData = {};

  for (const [key, value] of Object.entries(schedule)) {
    // Normalize month key: legacy month names use the current year; YYYY-MM keys are preserved.
    const monthKey = resolveScheduleMonthKey(key);
    if (!monthKey) continue; // Unknown month, skip

    // Case 1: Array of entries (canonical format)
    if (Array.isArray(value)) {
      const entries = value.map(normalizeEntry).filter((e): e is NonNullable<typeof e> => e !== null);
      if (entries.length > 0) result[monthKey] = entries;
    }
    // Case 2: Dict of day→entry
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
  // Unique tmp name: concurrent saves of the same file must not share one
  // temp path between the awaited write and rename.
  const tmpPath = `${filePath}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, filePath);
    writeHealth.lastWriteTime = new Date().toISOString();
    writeHealth.lastWriteSuccess = true;
    writeHealth.lastError = null;
    writeHealth.lastErrorTime = null;
    writeHealth.consecutiveFailures = 0;
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => {});
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
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      console.warn(`[DATA] ${filename} not found, using fallback`);
      return fallback;
    }
    console.error(`[DATA] FATAL: could not load ${filename}:`, err.message);
    throw new Error(`Failed to load ${filename}: ${err.message}`);
  }
}

export async function loadData(): Promise<void> {
  console.log('[DATA] Loading trail data...');

  const trailsData: TrailsData = await loadFile('trails.json', { trails: [] });
  const rawTrails = Array.isArray(trailsData.trails) ? trailsData.trails : [];
  trails = rawTrails.map((t: any) => {
    const { gpxData: _, ...rest } = t;
    return { ...rest, seasonal: normalizeSeasonal(rest.seasonal) };
  });

  trailDetails = await loadFile('trail_details.json', {});
  lookup = await loadFile('lookup.json', { difficulties: [], parkingLevels: {} });
  const scheduleFile = getScheduleFile();
  schedule = normalizeSchedule(await loadFile(scheduleFile, {}));
  console.log(`[DATA] Loaded schedule: ${scheduleFile} (${Object.keys(schedule).length} months)`);
  gpxIndex = await loadFile('gpx_index.json', {});

  // Attach gpxFile to each trail
  trails = trails.map(t => ({ ...t, gpxFile: gpxIndex[t.id] || undefined }));

  // Attach durations for trails with GPX
  console.log('[DATA] Calculating hike durations from GPX files...');
  const gpxDir = path.join(DATA_DIR, 'gpx');
  for (const trail of trails) {
    if (trail.gpxFile) {
      const gpxPath = path.join(gpxDir, trail.gpxFile);
      try {
        const duration = await extractDurationFromGpx(gpxPath);
        if (duration) {
          (trail as any).durationMinutes = duration.minutes;
          (trail as any).duration = duration.formatted;
        }
      } catch (error) {
        // Skip trails with errors
      }
    }
  }

  console.log(`[DATA] Loaded ${trails.length} trails, ${Object.keys(trailDetails).length} details, ${Object.keys(gpxIndex).length} GPX mappings`);
  console.log(`[DATA] Schedule months: ${Object.keys(schedule).join(', ') || '(none)'}`);
  if (Object.keys(schedule).length === 0) {
    console.warn('[DATA] Schedule is empty — use TSV import (Import Hike Tsv) or ScheduleBuilder to add hikes, not direct JSON editing');
  }
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
  // Own-property guard against inherited keys ('__proto__', 'toString', ...).
  return Object.prototype.hasOwnProperty.call(trailDetails, id) ? trailDetails[id] : undefined;
}

export function getLookup(): LookupData {
  return lookup;
}

export function getSchedule(): ScheduleData {
  return { ...schedule };
}

// Delete an uploaded GPX file (if present) and drop its cached duration.
export async function removeUploadedGpxFile(fileName: string | undefined | null): Promise<void> {
  if (!fileName || !isSafeGpxFilename(fileName)) return;
  const gpxPath = path.join(GPX_UPLOAD_DIR, fileName);
  durationCache.delete(gpxPath);
  await fs.unlink(gpxPath).catch(() => {});
}

async function updateGpxForTrail(trailId: string, gpxData?: string, gpxFile?: string, gpxFileRemoved?: boolean): Promise<boolean> {
  if (gpxData) {
    await fs.mkdir(GPX_UPLOAD_DIR, { recursive: true });
    const gpxFileName = getGpxUploadFileName(trailId);
    const gpxFilePath = path.join(GPX_UPLOAD_DIR, gpxFileName);
    await fs.writeFile(gpxFilePath, gpxData, 'utf-8');
    durationCache.delete(gpxFilePath);
    gpxIndex[trailId] = gpxFileName;
    return true;
  }
  if (gpxFile) {
    gpxIndex[trailId] = gpxFile;
    return true;
  }
  if (gpxFileRemoved || gpxData === '') {
    const oldGpxFile = gpxIndex[trailId];
    await removeUploadedGpxFile(oldGpxFile);
    delete gpxIndex[trailId];
    return false;
  }
  return !!gpxIndex[trailId];
}

// Stamp (or clear) the GPX fingerprint fields on a trail record from the file
// that would actually be served (upload dir first, then original GPX dir —
// same order as trails.routes.ts resolveGpxPath). Cleared, not left stale,
// when the mapped file cannot be read.
async function stampGpxFingerprint(trail: Trail): Promise<void> {
  delete trail.gpxBytes;
  delete trail.gpxModified;
  delete trail.gpxSha1;
  const fileName = gpxIndex[trail.id];
  if (!fileName || !isSafeGpxFilename(fileName)) return;
  for (const dir of [GPX_UPLOAD_DIR, GPX_DIR]) {
    try {
      const p = path.join(dir, fileName);
      const [buf, st] = await Promise.all([fs.readFile(p), fs.stat(p)]);
      trail.gpxBytes = st.size;
      trail.gpxModified = st.mtime.toISOString();
      trail.gpxSha1 = crypto.createHash('sha1').update(buf).digest('hex');
      return;
    } catch { /* not here, try next dir */ }
  }
}

export async function updateTrail(trail: Trail & { gpxData?: string }): Promise<void> {
  const trailIdx = trails.findIndex(t => t.id === trail.id);
  const { gpxData, ...trailWithoutGpx } = trail;
  const updatedTrail: Trail = { ...trailWithoutGpx };

  const hasGpx = await updateGpxForTrail(
    trail.id,
    gpxData,
    updatedTrail.gpxFile || undefined,
    updatedTrail.gpxFile === ''
  );
  updatedTrail.hasGpx = hasGpx;
  await stampGpxFingerprint(updatedTrail);

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
  const oldGpxFile = gpxIndex[id];
  delete gpxIndex[id];

  for (const month of Object.keys(schedule)) {
    const entries = schedule[month];
    if (!Array.isArray(entries)) continue;
    const filtered = entries.filter(entry => entry?.trail_id !== id);
    if (filtered.length === 0) {
      delete schedule[month];
    } else if (filtered.length !== entries.length) {
      schedule[month] = filtered;
    }
  }

  // Remove uploaded GPX file(s) if they exist
  await removeUploadedGpxFile(getGpxUploadFileName(id));
  await removeUploadedGpxFile(oldGpxFile);

  await writeWithHealth(path.join(DATA_DIR, 'trails.json'), { trails });
  await writeWithHealth(path.join(DATA_DIR, 'trail_details.json'), trailDetails);
  await writeWithHealth(path.join(DATA_DIR, 'gpx_index.json'), gpxIndex);
  await writeWithHealth(path.join(DATA_DIR, getScheduleFile()), schedule);
}

export async function updateTrailDetail(id: string, detail: TrailDetail): Promise<void> {
  trailDetails[id] = detail;
  await writeWithHealth(path.join(DATA_DIR, 'trail_details.json'), trailDetails);
}

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

export async function restoreScheduleByTimestamp(timestamp: string): Promise<ScheduleData> {
  const files = await fs.readdir(HISTORY_DIR);
  for (const f of files) {
    if (!f.startsWith('schedule_') || !f.endsWith('.json')) continue;
    try {
      const content = await fs.readFile(path.join(HISTORY_DIR, f), 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.timestamp === timestamp && parsed.schedule) {
        const restored = normalizeSchedule(parsed.schedule);
        // Persist first: if the write fails, memory keeps serving the old
        // schedule instead of diverging from disk.
        await writeWithHealth(path.join(DATA_DIR, getScheduleFile()), restored);
        schedule = restored;
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
  schedule = normalizeSchedule(newSchedule);
  await writeWithHealth(path.join(DATA_DIR, getScheduleFile()), schedule);
}

export function getGpxIndex(): Record<string, string> {
  return { ...gpxIndex };
}

export function setGpxIndex(index: Record<string, string>): void {
  gpxIndex = index;
}

export function getGpxFileName(trailId: string): string | undefined {
  // Own-string check: gpxIndex is a plain object, so inherited keys like
  // '__proto__' or 'constructor' would otherwise return prototype values.
  const file = gpxIndex[trailId];
  return typeof file === 'string' ? file : undefined;
}

export function getGpxUploadFileName(trailId: string): string {
  const base = path.basename(String(trailId)).replace(/\0/g, '');
  const withoutExt = base.toLowerCase().endsWith('.gpx') ? base.slice(0, -4) : base;
  const safe = withoutExt.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '');
  return `${safe || 'trail'}.gpx`;
}

export function getScheduleVersion(): string {
  try {
    const content = fsSync.readFileSync(path.join(DATA_DIR, getScheduleFile()), 'utf-8');
    return generateEtag(content, 32);
  } catch {
    return '';
  }
}

export function serverVersion(): string {
  try {
    const dir = getCurrentDir(import.meta.url);
    const pkg = JSON.parse(fsSync.readFileSync(path.join(dir, '../../package.json'), 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

const _loadDataPromise = loadData().catch(err => {
  console.error('[DATA] Failed to load initial data:', err);
});

export async function waitForDataReady() {
  await _loadDataPromise;
}
