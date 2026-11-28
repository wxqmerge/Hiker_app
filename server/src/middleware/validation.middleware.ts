import { z } from 'zod';
import { parseMaxHikesPerDay } from '../utils/slotCap.js';

// --- Slot cap (derived from MAX_HIKES_PER_DAY, default 3) ---
// Enforces the per-day slot limit at the API write boundary. Slots are 0-based,
// so a group allowing N hikes/day accepts slot indices 0..N-1.
const MAX_SLOT = parseMaxHikesPerDay() - 1;

// --- Trail field whitelist ---
// gpxData was the pre-file-upload embedded-GPX field: it wrote raw request
// text straight to the gpx/ dir, bypassing upload validation and the
// same-bytes guard, and no client sends it anymore - removed. hasGpx is
// server-derived (dataService recomputes it from the binding on every write).
const TRAIL_FIELDS = new Set([
  'name', 'fullName', 'distance', 'distanceExtended',
  'elevationStart', 'elevationMax', 'difficulty',
  'parking', 'range', 'notes', 'altNames', 'difficultyOrder',
  'seasonal', 'webLink', 'tideStationId', 'gpxFile', 'trailHeadLat', 'trailHeadLon',
]);

const TRAIL_DETAIL_FIELDS = new Set([
  'fullDescription', 'pros', 'others', 'leaders',
  'popularity',
]);

// --- Schedule entry schema ---
const ScheduleEntrySchema = z.object({
  day: z.number().int().min(1).max(31),
  slot: z.number().int().nonnegative().max(MAX_SLOT).default(0),
  trail_id: z.string().default(''),
  early_start: z.union([z.boolean(), z.number()]).default(0),
  leader: z.string().default(''),
});

// Month keys are 'YYYY-MM' (getMonthKey). The strict key pattern also keeps
// __proto__ and similar exotic keys out of the parsed schedule object.
const SCHEDULE_MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const ScheduleSchema = z.record(
  z.string().regex(SCHEDULE_MONTH_KEY, 'month key must be YYYY-MM'),
  z.array(ScheduleEntrySchema),
);
export { ScheduleSchema };

// --- Restore timestamp schema ---
export const RestoreTimestampSchema = z.object({
  timestamp: z.string(),
});

// --- Trail/detail ID safety ---
// URL :id values reach object-key writes (trailDetails[id] = ...). The
// prototype-hitchhiking names (__proto__/constructor/prototype) would hit
// setters instead of creating entries. All 200+ real trail IDs are ASCII
// slug-safe, so [\w.-]+ costs nothing; '..' is rejected for path-shaped
// noise. Keyed-object READ paths keep their own independent guards.
const SAFE_TRAIL_ID = /^[\w.-]+$/;
const UNSAFE_ID_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

export function isSafeTrailId(id: string): boolean {
  return (
    typeof id === 'string' &&
    SAFE_TRAIL_ID.test(id) &&
    !id.includes('..') &&
    !UNSAFE_ID_NAMES.has(id)
  );
}

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
