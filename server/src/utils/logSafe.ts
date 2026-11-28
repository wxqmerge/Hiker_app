// Express percent-decodes req.path, so a crafted URL can smuggle raw
// newlines/control characters into our console lines (log forging in
// journalctl). Strip C0 controls + DEL before interpolating request data.
// eslint-disable-next-line no-control-regex
export function logSafe(value: string): string {
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '');
}
