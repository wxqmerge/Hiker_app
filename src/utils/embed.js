/**
 * True when the app is running inside an iframe (e.g. embedded in the
 * club's Google Sites page). Plain identity comparison — never touches
 * cross-origin properties, so it cannot throw.
 * @param {Window} [w] window to test (injectable for tests)
 * @returns {boolean}
 */
export function isEmbedded(w = window) {
  return w.self !== w.top;
}
