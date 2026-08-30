import { getUnitSystem } from './config';

const KM_PER_MILE = 1.609344;
const FT_PER_METER = 3.28084;

/**
 * Convert a distance from miles to the display unit.
 * @param {number} miles - Distance in miles.
 * @returns {number} Distance in the display unit.
 */
export function convertDistance(miles) {
  if (getUnitSystem() === 'metric') {
    return miles * KM_PER_MILE;
  }
  return miles;
}

/**
 * Convert an elevation from feet to the display unit.
 * @param {number} feet - Elevation in feet.
 * @returns {number} Elevation in the display unit.
 */
export function convertElevation(feet) {
  if (getUnitSystem() === 'metric') {
    return feet / FT_PER_METER;
  }
  return feet;
}

/**
 * Get the distance unit label.
 * @returns {string} 'mi' or 'km'
 */
export function getDistanceUnit() {
  return getUnitSystem() === 'metric' ? 'km' : 'mi';
}

/**
 * Get the elevation unit label.
 * @returns {string} 'ft' or 'm'
 */
export function getElevationUnit() {
  return getUnitSystem() === 'metric' ? 'm' : 'ft';
}

/**
 * Format a distance for display.
 * @param {number} miles - Distance in miles.
 * @returns {string} Formatted distance with unit.
 */
export function formatDistance(miles) {
  const value = Number(convertDistance(miles));
  const unit = getDistanceUnit();
  if (isNaN(value)) return `— ${unit}`;
  return `${value.toFixed(1)} ${unit}`;
}

/**
 * Format an elevation for display.
 * @param {number} feet - Elevation in feet.
 * @returns {string} Formatted elevation with unit.
 */
export function formatElevation(feet) {
  const value = Number(convertElevation(feet));
  const unit = getElevationUnit();
  if (isNaN(value)) return `— ${unit}`;
  return `${Math.round(value)} ${unit}`;
}

/**
 * Format an elevation change for display.
 * @param {number} feet - Elevation change in feet (positive = up, negative = down).
 * @returns {string} Formatted elevation change with unit and sign.
 */
export function formatElevationChange(feet) {
  const value = Number(convertElevation(feet));
  const unit = getElevationUnit();
  if (isNaN(value)) return `— ${unit}`;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Math.round(value)} ${unit}`;
}
