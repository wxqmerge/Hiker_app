// Data utilities for trail lookup and manipulation
import { MONTH_ABBR } from './constants';

/**
 * Find a trail by ID with fallback matching strategies:
 * 1. Exact match
 * 2. Case-insensitive match
 * 3. Slug word matching (e.g. "mount-rainier" matches "Mount Rainier")
 * @param {Array} trails - Array of trail objects
 * @param {string} trailId - Trail ID to lookup
 * @returns {Object|null} - Trail object or null
 */
export function findTrailById(trails, trailId) {
  if (!trails || !trailId) return null;

  // Exact match
  const exact = trails.find(t => t.id === trailId);
  if (exact) return exact;

  // Case-insensitive match
  const lower = trailId.toLowerCase();
  const ciMatch = trails.find(t => t.id.toLowerCase() === lower);
  if (ciMatch) return ciMatch;

  // Slug word matching
  const slugWords = lower.split('-').filter(Boolean);
  if (slugWords.length > 1) {
    return trails.find(t => {
      const name = ((t.fullName || t.name) || '').toLowerCase();
      return slugWords.every(w => name.includes(w));
    }) || null;
  }

  return null;
}

/**
 * Get the index of a trail by ID with fallback matching
 * @param {Array} trails - Array of trail objects
 * @param {string} trailId - Trail ID to lookup
 * @returns {number} - Index or -1
 */
export function findTrailIndexById(trails, trailId) {
  if (!trails || !trailId) return -1;

  let idx = trails.findIndex(t => t.id === trailId);
  if (idx >= 0) return idx;

  const lower = trailId.toLowerCase();
  idx = trails.findIndex(t => t.id.toLowerCase() === lower);
  return idx;
}

/**
 * Extract available months from seasonal data
 * @param {Object} seasonal - Seasonal data object
 * @returns {Array<number>} - Array of 1-based month indices
 */
export function getAvailableMonthsFromSeasonal(seasonal) {
  if (!seasonal) return [];
  return Object.entries(seasonal)
    .filter(([k, v]) => typeof v === 'number' && v > 0 && MONTH_ABBR.indexOf(k) !== -1)
    .map(([k]) => MONTH_ABBR.indexOf(k) + 1);
}

/**
 * Get trail details with fallback for ID mismatch
 * Handles cases like "360-rd" vs "360"
 * @param {Object} details - Trail details object
 * @param {string} trailId - Trail ID to lookup
 * @returns {Object|null} - Formatted details or null
 */
export function getTrailDetailsById(details, trailId) {
  if (!details || !trailId) return null;

  // Try exact match first
  if (details[trailId]) {
    return { [trailId]: details[trailId] };
  }

  // Fallback: trail ID with extra segment (e.g. "360-rd" -> look for "360")
  const segments = trailId.split('-');
  if (segments.length > 1) {
    const baseId = segments.slice(0, -1).join('-');
    if (details[baseId]) {
      return { [trailId]: details[baseId] };
    }
  }

  return null;
}
