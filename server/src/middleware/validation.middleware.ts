import { z } from 'zod';

// --- Trail field whitelist ---
export const TRAIL_FIELDS = new Set([
  'name', 'fullName', 'distance', 'distanceExtended',
  'elevationStart', 'elevationMax', 'difficulty',
  'parking', 'range', 'notes', 'altNames', 'difficultyOrder',
  'seasonal', 'webLinks',
]);

export const TRAIL_DETAIL_FIELDS = new Set([
  'fullDescription', 'pros', 'others', 'leaders',
  'popularity',
]);

// --- Schedule entry schema ---
export const ScheduleEntrySchema = z.object({
  day: z.number().int().positive(),
  hike: z.string().default(''),
  trail_id: z.string().default(''),
  early_start: z.boolean().default(false),
  leader: z.string().default(''),
});

export const ScheduleSchema = z.record(z.string(), z.array(ScheduleEntrySchema));

// --- Trail update schema ---
export const TrailUpdateSchema = z.object({
  name: z.string().optional(),
  fullName: z.string().optional(),
  distance: z.number().optional(),
  distanceExtended: z.number().optional(),
  elevationStart: z.number().optional(),
  elevationMax: z.number().optional(),
  difficulty: z.string().optional(),
  parking: z.string().optional(),
  range: z.string().optional(),
  notes: z.string().optional(),
  altNames: z.array(z.string()).optional(),
  difficultyOrder: z.number().optional(),
  seasonal: z.record(z.string(), z.unknown()).optional(),
  webLinks: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
  })).optional(),
});

// --- Trail detail update schema ---
export const TrailDetailUpdateSchema = z.object({
  fullDescription: z.string().optional(),
  pros: z.string().optional(),
  others: z.string().optional(),
  leaders: z.array(z.string()).optional(),
  popularity: z.object({
    monthly: z.array(z.number()).optional(),
    monthlyScore: z.array(z.number()).optional(),
  }).optional(),
});

// --- Restore timestamp schema ---
export const RestoreTimestampSchema = z.object({
  timestamp: z.string(),
});

// --- Helper: whitelist req.body fields for trail updates ---
export function whitelistTrailFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (TRAIL_FIELDS.has(key)) {
      result[key] = body[key];
    }
  }
  return result;
}

// --- Helper: whitelist req.body fields for trail detail updates ---
export function whitelistTrailDetailFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (TRAIL_DETAIL_FIELDS.has(key)) {
      result[key] = body[key];
    }
  }
  return result;
}
