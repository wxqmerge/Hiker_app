#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const serverDist = path.join(projectRoot, 'server', 'dist');

// TypeScript outputs directly to server/dist/ (no nesting).
// This script handles bughouse-style nested output (server/dist/server/src/).
// If nested output exists, flatten it. Otherwise, output is already flat.

const serverSrcDist = path.join(serverDist, 'server', 'src');

if (!fs.existsSync(serverSrcDist)) {
  console.log('  TypeScript output already flat in dist/. Nothing to flatten.');
  process.exit(0);
}

function copyDir(src, dest) {
  for (const entry of fs.readdirSync(src)) {
    if (entry === '.temp-compile') continue;
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const oldDistContents = fs.existsSync(serverDist) ? fs.readdirSync(serverDist) : [];
for (const entry of oldDistContents) {
  if (entry !== 'server') {
    fs.rmSync(path.join(serverDist, entry), { recursive: true, force: true });
  }
}
copyDir(serverSrcDist, serverDist);
fs.rmSync(path.join(serverDist, 'server'), { recursive: true, force: true });
console.log('  Flattened server dist output to dist/');
