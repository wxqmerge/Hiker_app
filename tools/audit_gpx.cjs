#!/usr/bin/env node
// Read-only GPX audit: cross-checks gpx_index.json, per-trail gpxFile fields,
// recorded fingerprints (gpxBytes/gpxSha1), and actual files in the upload and
// original GPX directories. Mirrors server resolution order (upload dir wins).
//
// Usage: node tools/audit_gpx.cjs [--data exported_data] [--root .] [--json out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
function flag(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
}
const ROOT = path.resolve(flag('root', process.cwd()));
const DATA_DIR = path.resolve(ROOT, flag('data', 'exported_data'));
const GPX_ORIG = path.join(ROOT, 'GPX');            // paths.js GPX_DIR
const GPX_UPLOAD = path.join(DATA_DIR, 'gpx');      // paths.js GPX_UPLOAD_DIR
const OUT_JSON = flag('json', null);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function listGpx(dir) {
  try {
    return new Set(fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.gpx')));
  } catch { return new Set(); }
}
function sha1(file) {
  const h = crypto.createHash('sha1');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}
function statOf(dir, name) {
  const p = path.join(dir, name);
  try { const s = fs.statSync(p); return { path: p, bytes: s.size, mtime: s.mtime.toISOString() }; }
  catch { return null; }
}

const trails = readJson(path.join(DATA_DIR, 'trails.json')).trails || [];
const gpxIndex = (() => { try { return readJson(path.join(DATA_DIR, 'gpx_index.json')); } catch { return {}; } })();
const uploadFiles = listGpx(GPX_UPLOAD);
const origFiles = listGpx(GPX_ORIG);

const findings = [];
const add = (kind, detail) => findings.push({ kind, ...detail });

const resolved = new Map(); // absPath -> [trailId]
const contentMap = new Map(); // sha1 -> [{trailId, path}]

for (const t of trails) {
  const idxFile = gpxIndex[t.id];
  const fldFile = t.gpxFile;
  const file = idxFile || fldFile;

  if (idxFile && fldFile && idxFile !== fldFile) {
    add('index_vs_field_mismatch', { trailId: t.id, index: idxFile, field: fldFile });
  }
  if (!file) {
    if (t.hasGpx) add('has_gpx_no_mapping', { trailId: t.id });
    continue;
  }

  // serve resolution order (trails.routes.ts resolveGpxPath): upload dir first
  const inUpload = statOf(GPX_UPLOAD, file);
  const inOrig = statOf(GPX_ORIG, file);
  const winner = inUpload || inOrig;

  if (!winner) {
    add('file_missing', { trailId: t.id, file });
  } else {
    const served = inUpload || inOrig;
    resolved.set(served.path, (resolved.get(served.path) || []).concat(t.id));
    if (inUpload && inOrig) {
      const a = sha1(inUpload.path), b = sha1(inOrig.path);
      if (a !== b) add('shadow_copy_differs', { trailId: t.id, file, servedBytes: inUpload.bytes, hiddenBytes: inOrig.bytes });
    }
    contentMap.set(sha1(served.path), (contentMap.get(sha1(served.path)) || []).concat({ trailId: t.id, file }));
    // recorded fingerprint vs actual
    if (t.gpxBytes != null && t.gpxBytes !== served.bytes) {
      add('recorded_bytes_mismatch', { trailId: t.id, file, recorded: t.gpxBytes, actual: served.bytes });
    }
    if (t.gpxSha1) {
      const actual = sha1(served.path);
      if (actual !== t.gpxSha1) add('recorded_sha1_mismatch', { trailId: t.id, file, recorded: t.gpxSha1, actual });
    } else if (t.gpxBytes == null) {
      add('no_fingerprint', { trailId: t.id, file });
    }
  }
}

// multiple trails resolving to the same file
for (const [p, ids] of resolved) {
  if (ids.length > 1) add('shared_file', { file: path.basename(p), trailIds: ids });
}
// multiple trails whose served content is identical (different files, same content)
for (const [h, entries] of contentMap) {
  const uniq = [...new Set(entries.map(e => e.trailId))];
  if (uniq.length > 1 && entries.length > 1) add('duplicate_content', { sha1: h, trails: entries });
}

// orphans: on disk but not referenced by any trail mapping
const referenced = new Set(Object.values(gpxIndex).concat(trails.map(t => t.gpxFile).filter(Boolean)));
for (const f of uploadFiles) if (!referenced.has(f)) add('orphan_upload', { file: f });
for (const f of origFiles) if (!referenced.has(f)) add('orphan_orig', { file: f });

const counts = {};
for (const f of findings) counts[f.kind] = (counts[f.kind] || 0) + 1;

console.log(`DATA_DIR=${DATA_DIR}`);
console.log(`trails=${trails.length}  index_entries=${Object.keys(gpxIndex).length}  upload_files=${uploadFiles.size}  orig_files=${origFiles.size}`);
console.log('--- findings ---');
for (const [k, n] of Object.entries(counts)) console.log(`${k}: ${n}`);
if (!findings.length) console.log('(none)');
for (const f of findings) console.log(JSON.stringify(f));

if (OUT_JSON) {
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), counts, findings }, null, 2));
  console.log(`report written: ${OUT_JSON}`);
}
process.exit(0);
