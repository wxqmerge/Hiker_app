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

export async function updateSchedule(newSchedule: ScheduleData): Promise<void> {
  schedule = newSchedule;
  await writeWithHealth(path.join(DATA_DIR, 'schedule.json'), schedule);
}

export async function updateScheduleMonth(month: string, entries: ScheduleData[string]): Promise<void> {
  schedule[month] = entries;
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
