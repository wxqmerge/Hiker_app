import { z } from 'zod';

// --- Trail field whitelist ---
export const TRAIL_FIELDS = new Set([
  'name', 'fullName', 'distance', 'distanceExtended',
  'elevationStart', 'elevationMax', 'difficulty',
  'parking', 'range', 'notes', 'altNames', 'difficultyOrder',
  'seasonal', 'webLink', 'tideStationId', 'gpxData', 'hasGpx', 'gpxFile', 'trailHeadLat', 'trailHeadLon',
]);

export const TRAIL_DETAIL_FIELDS = new Set([
  'fullDescription', 'pros', 'others', 'leaders',
  'popularity',
]);

// --- Schedule entry schema ---
export const ScheduleEntrySchema = z.object({
  day: z.number().int().positive(),
  slot: z.number().int().nonnegative().default(0),
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
