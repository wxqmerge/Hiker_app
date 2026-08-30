import { z } from 'zod';

// --- Slot cap (derived from MAX_HIKES_PER_DAY, default 3) ---
// Enforces the per-day slot limit at the API write boundary. Slots are 0-based,
// so a group allowing N hikes/day accepts slot indices 0..N-1.
const maxHikesPerDay = Math.min(7, Math.max(1, parseInt(process.env.MAX_HIKES_PER_DAY || '3', 10) || 3));
const MAX_SLOT = maxHikesPerDay - 1;

// --- Trail field whitelist ---
const TRAIL_FIELDS = new Set([
  'name', 'fullName', 'distance', 'distanceExtended',
  'elevationStart', 'elevationMax', 'difficulty',
  'parking', 'range', 'notes', 'altNames', 'difficultyOrder',
  'seasonal', 'webLink', 'tideStationId', 'gpxData', 'hasGpx', 'gpxFile', 'trailHeadLat', 'trailHeadLon',
]);

const TRAIL_DETAIL_FIELDS = new Set([
  'fullDescription', 'pros', 'others', 'leaders',
  'popularity',
]);

// --- Schedule entry schema ---
const ScheduleEntrySchema = z.object({
  day: z.number().int().positive(),
  slot: z.number().int().nonnegative().max(MAX_SLOT).default(0),
  trail_id: z.string().default(''),
  early_start: z.union([z.boolean(), z.number()]).default(0),
  leader: z.string().default(''),
});

export const ScheduleSchema = z.record(z.string(), z.array(ScheduleEntrySchema));

// --- Restore timestamp schema ---
export const RestoreTimestampSchema = z.object({
  timestamp: z.string(),
});

// --- Helper: whitelist req.body fields ---
function whitelistFields(body: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (allowed.has(key)) {
      result[key] = body[key];
    }
  }
  return result;
}

// --- Helper: whitelist req.body fields for trail updates ---
export function whitelistTrailFields(body: Record<string, unknown>): Record<string, unknown> {
  return whitelistFields(body, TRAIL_FIELDS);
}

// --- Helper: whitelist req.body fields for trail detail updates ---
export function whitelistTrailDetailFields(body: Record<string, unknown>): Record<string, unknown> {
  return whitelistFields(body, TRAIL_DETAIL_FIELDS);
}
