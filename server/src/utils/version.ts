import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

export function buildVersion(): { hash: string; ts: string; full: string } {
  const ts = new Date().toISOString();
  let gitHash = 'unknown';
  try {
    gitHash = fs.readFileSync(path.join(__dirname, '../../../.git/HEAD'), 'utf-8').trim().split(' ')[1];
    gitHash = fs.readFileSync(path.join(__dirname, '../../../.git', gitHash), 'utf-8').trim().substring(0, 7);
  } catch {
    try {
      gitHash = fs.readFileSync(path.join(__dirname, '../../../.git/HEAD'), 'utf-8').trim().substring(5, 12);
    } catch {
      gitHash = 'unknown';
    }
  }
  const full = `${gitHash}-${ts}`;
  const hash = createHash('sha256').update(full).digest('hex').substring(0, 8);
  return { hash, ts, full };
}
