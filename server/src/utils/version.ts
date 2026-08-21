import { createHash } from 'crypto';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');

export function buildVersion(): { hash: string; ts: string; full: string } {
  const ts = new Date().toISOString();
  let gitHash = 'unknown';
  try {
    gitHash = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
  } catch {
    gitHash = 'unknown';
  }
  const full = `${gitHash}-${ts}`;
  const hash = createHash('sha256').update(full).digest('hex').substring(0, 8);
  return { hash, ts, full };
}
