#!/usr/bin/env node
// Stamp gpxBytes / gpxModified / gpxSha1 onto every trail whose GPX file can
// be resolved (upload dir first, original GPX dir second — same order the
// server serves with). Run on the server after deploying the fingerprint
// feature, and re-run any time GPX files are replaced out-of-band.
//
// Usage: node tools/gpx_meta_backfill.cjs [--data exported_data] [--root .] [--dry-run]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
function flag(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
}
const DRY = argv.includes('--dry-run');
const ROOT = path.resolve(flag('root', process.cwd()));
const DATA_DIR = path.resolve(ROOT, flag('data', 'exported_data'));
const GPX_ORIG = path.join(ROOT, 'GPX');
const GPX_UPLOAD = path.join(DATA_DIR, 'gpx');

const trailsPath = path.join(DATA_DIR, 'trails.json');
const data = JSON.parse(fs.readFileSync(trailsPath, 'utf8'));
const trails = data.trails || [];
let gpxIndex = {};
try { gpxIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'gpx_index.json'), 'utf8')); } catch { /* none */ }

function resolveFile(name) {
  for (const dir of [GPX_UPLOAD, GPX_ORIG]) {
    const p = path.join(dir, name);
    try { fs.accessSync(p); return p; } catch { /* next */ }
  }
  return null;
}

let stamped = 0, cleared = 0, unresolved = [];
for (const t of trails) {
  const fileName = gpxIndex[t.id] || t.gpxFile;
  const p = fileName ? resolveFile(fileName) : null;
  if (p) {
    const buf = fs.readFileSync(p);
    const st = fs.statSync(p);
    t.gpxBytes = buf.length;
    t.gpxModified = st.mtime.toISOString();
    t.gpxSha1 = crypto.createHash('sha1').update(buf).digest('hex');
    stamped++;
  } else {
    if (t.gpxBytes != null || t.gpxSha1) { delete t.gpxBytes; delete t.gpxModified; delete t.gpxSha1; cleared++; }
    if (fileName) unresolved.push(`${t.id} -> ${fileName}`);
  }
}

console.log(`trails=${trails.length} stamped=${stamped} cleared_stale=${cleared} unresolved=${unresolved.length}`);
for (const u of unresolved) console.log(`  unresolved: ${u}`);

if (DRY) {
  console.log('(dry run — nothing written)');
} else {
  const tmp = trailsPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, trailsPath);
  console.log(`written: ${trailsPath}`);
}
