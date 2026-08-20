import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');

function readPackedRef(ref: string): string | null {
  try {
    const packedRefs = fs.readFileSync(path.join(REPO_ROOT, '.git', 'packed-refs'), 'utf-8');
    for (const line of packedRefs.split('\n')) {
      if (line.startsWith('#') || line.startsWith('^')) continue;
      const [hash, name] = line.split(' ');
      if (name === ref) return hash.substring(0, 7);
    }
  } catch {
    // packed-refs may not exist
  }
  return null;
}

export function buildVersion(): { hash: string; ts: string; full: string } {
  const ts = new Date().toISOString();
  let gitHash = 'unknown';
  try {
    const head = fs.readFileSync(path.join(REPO_ROOT, '.git', 'HEAD'), 'utf-8').trim();
    if (head.startsWith('ref:')) {
      const ref = head.slice(5).trim();
      try {
        gitHash = fs.readFileSync(path.join(REPO_ROOT, '.git', ref), 'utf-8').trim().substring(0, 7);
      } catch {
        gitHash = readPackedRef(ref) || 'unknown';
      }
    } else {
      gitHash = head.substring(0, 7);
    }
  } catch {
    gitHash = 'unknown';
  }
  const full = `${gitHash}-${ts}`;
  const hash = createHash('sha256').update(full).digest('hex').substring(0, 8);
  return { hash, ts, full };
}
