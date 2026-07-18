import { fileURLToPath } from 'url';
import path from 'path';

export function getCurrentDir(url: string): string {
  return path.dirname(fileURLToPath(url));
}
