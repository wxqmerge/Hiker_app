import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Trail, TrailDetail, ScheduleData, LookupData, TrailsData, TrailDetailsData } from '@shared/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../../exported_data');

console.log(`[DATA] Loading from: ${DATA_DIR}`);

let trails: Trail[] = [];
let trailDetails: TrailDetailsData = {};
let lookup: LookupData = { difficulties: [], parkingLevels: {} };
let schedule: ScheduleData = {};

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

  const trailsData: TrailsData = await loadFile('trails.json', { trails: [] });
  trails = trailsData.trails || [];

  trailDetails = await loadFile('trail_details.json', {});
  lookup = await loadFile('lookup.json', { difficulties: [], parkingLevels: {} });
  schedule = await loadFile('schedule.json', {});

  console.log(`[DATA] Loaded ${trails.length} trails, ${Object.keys(trailDetails).length} details`);
  console.log(`[DATA] Schedule months: ${Object.keys(schedule).join(', ') || '(none)'}`);
}

export function getTrails(): Trail[] {
  return trails;
}

export function getTrailById(id: string): Trail | undefined {
  return trails.find(t => t.id === id);
}

export function getTrailDetails(): TrailDetailsData {
  return trailDetails;
}

export function getTrailDetailById(id: string): TrailDetail | undefined {
  return trailDetails[id];
}

export function getLookup(): LookupData {
  return lookup;
}

export function getSchedule(): ScheduleData {
  return schedule;
}

export async function updateTrail(trail: Trail): Promise<void> {
  const idx = trails.findIndex(t => t.id === trail.id);
  if (idx >= 0) {
    trails[idx] = trail;
  } else {
    trails.push(trail);
  }
  await writeWithHealth(path.join(DATA_DIR, 'trails.json'), { trails });
}

export async function deleteTrail(id: string): Promise<void> {
  trails = trails.filter(t => t.id !== id);
  delete trailDetails[id];
  await writeWithHealth(path.join(DATA_DIR, 'trails.json'), { trails });
  await writeWithHealth(path.join(DATA_DIR, 'trail_details.json'), trailDetails);
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
      } catch { /* skip corrupt files */ }
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
        await writeWithHealth(path.join(DATA_DIR, 'schedule.json'), schedule);
        return schedule;
      }
    } catch { /* skip */ }
  }
  throw new Error(`No history entry found for timestamp: ${timestamp}`);
}

export async function updateSchedule(newSchedule: ScheduleData): Promise<void> {
  // Archive current schedule before overwriting
  if (Object.keys(schedule).length > 0) {
    await saveScheduleHistory(schedule);
  }
  schedule = newSchedule;
  await writeWithHealth(path.join(DATA_DIR, 'schedule.json'), schedule);
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
