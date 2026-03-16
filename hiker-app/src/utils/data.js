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
  
  // Fallback to first word only
  const firstWord = trailId.split('-')[0];
  if (details[firstWord]) {
    return { [trailId]: details[firstWord] };
  }
  
  return null;
}
