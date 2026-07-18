export function ensureArray(val) {
  return Array.isArray(val) ? val : (val ? [val] : []);
}
