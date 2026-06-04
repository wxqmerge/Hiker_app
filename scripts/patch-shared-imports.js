#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.join(__dirname, '..', 'shared');

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const before = content;

  content = content.replace(
    /(from\s+['"])(\.[^'"]+)(['"])/g,
    (match, prefix, importPath, suffix) => {
      if (!importPath.endsWith('.js') && !importPath.endsWith('.d.ts')) {
        return prefix + importPath + '.js' + suffix;
      }
      return match;
    }
  );

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

function walk(dir) {
  let count = 0;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      count += walk(full);
    } else if (file.endsWith('.js') && !file.endsWith('.d.ts')) {
      if (patchFile(full)) {
        console.log(`  Patched: ${path.relative(sharedDir, full)}`);
        count++;
      }
    }
  }
  return count;
}

const patched = walk(sharedDir);
console.log(`Patched ${patched} file(s) in shared/`);
