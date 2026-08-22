/**
 * Normalize an etag value: strip W/ prefix and surrounding quotes.
 */
function normalizeEtag(value: string): string {
  let v = value.trim();
  if (v.startsWith('W/')) v = v.slice(2);
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1);
  return v;
}

/**
 * Check if the client's If-None-Match header matches the server's etag.
 * Handles:
 *   - Quoted etags: "abc123"
 *   - Weak etags: W/"abc123"
 *   - Comma-separated lists: "abc123", "def456"
 *   - The special value "*" (matches any resource)
 */
export function etagMatches(ifNoneMatch: string | undefined, serverEtag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  const server = normalizeEtag(serverEtag);
  const candidates = ifNoneMatch.split(',').map(normalizeEtag);
  return candidates.includes(server);
}
