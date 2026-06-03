// Data utilities for trail lookup and manipulation

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
