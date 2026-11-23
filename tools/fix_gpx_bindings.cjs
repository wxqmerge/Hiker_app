#!/usr/bin/env node
/*
 * One-shot GPX hygiene migration for exported_data (local source of truth;
 * ships to prod via the normal import-zip flow, whose reconcile step prunes
 * the old filenames on the server).
 *
 * 1. Unbinds trail 'oat' (OAT - Adventure to Llama Trail): its GPX was the
 *    Dungeness-River-Road activity, which now lives on 'dungeness' (uploaded
 *    2026-11-23 via the app). Clears gpxFile/hasGpx and the trailHead +
 *    durationMinutes that were derived from that wrong activity. The stale
 *    file is moved to gpx_legacy_backup/, never deleted.
 * 2. Renames every bound file to <trail-id>.gpx — the exact sanitization the
 *    server's getGpxUploadFileName() already applies to app uploads, so
 *    legacy files converge on the convention new uploads produce.
 * 3. Syncs trails.json gpxFile/hasGpx with gpx_index.json (index wins; files
 *    on disk that are referenced by trail.gpxFile but missing from the index
 *    get added).
 * 4. Moves now-unreferenced files to exported_data/gpx_legacy_backup/.
 * 5. Reports byte-identical files across DIFFERENT trails (historical mixup
 *    vector; no automatic change).
 *
 * Usage: node tools/fix_gpx_bindings.cjs          # dry run
 *        node tools/fix_gpx_bindings.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APPLY = process.argv.includes('--apply');
const DATA_DIR = path.join(__dirname, '..', 'exported_data');
const GPX_DIR = path.join(DATA_DIR, 'gpx');
const BACKUP_DIR = path.join(DATA_DIR, 'gpx_legacy_backup');
const TRAILS_FILE = path.join(DATA_DIR, 'trails.json');
const INDEX_FILE = path.join(DATA_DIR, 'gpx_index.json');

// Mirrors server/src/services/dataService.ts getGpxUploadFileName()
function uploadNameFor(trailId) {
  const base = path.basename(String(trailId)).replace(/\0/g, '');
  const withoutExt = base.toLowerCase().endsWith('.gpx') ? base.slice(0, -4) : base;
  const safe = withoutExt.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '');
  return `${safe || 'trail'}.gpx`;
}

const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const readIf = (p) => { try { return fs.readFileSync(p); } catch { return null; } };
const moveAside = (file, why) => {
  const src = path.join(GPX_DIR, file);
  if (!fs.existsSync(src)) return;
  const dst = path.join(BACKUP_DIR, file);
  console.log(`  QUARANTINE ${file} (${why})${APPLY ? '' : ' [dry-run]'}`);
  if (APPLY) fs.renameSync(src, dst);
};

const trailsDoc = JSON.parse(fs.readFileSync(TRAILS_FILE, 'utf8'));
const trails = trailsDoc.trails;
const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
const trailById = new Map(trails.map((t) => [t.id, t]));
const diskFiles = new Set(fs.readdirSync(GPX_DIR).filter((f) => f.toLowerCase().endsWith('.gpx')));

const changes = [];
const problems = [];
const note = (s) => changes.push(s);

// ---- backups -------------------------------------------------------------
if (APPLY) {
  for (const f of [TRAILS_FILE, INDEX_FILE]) {
    const bak = `${f}.bak-gpxfix`;
    if (!fs.existsSync(bak)) fs.copyFileSync(f, bak);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ---- 1. unbind oat (activity actually belongs to dungeness) ---------------
{
  const oat = trailById.get('oat');
  if (oat && (oat.gpxFile || index['oat'])) {
    console.log(`UNBIND oat (was ${index['oat'] || oat.gpxFile})`);
    console.log(`  clearing trailHead ${oat.trailHeadLat},${oat.trailHeadLon} + durationMinutes ${oat.durationMinutes} (derived from the wrong activity; backups in *.bak-gpxfix)`);
    note('unbind oat');
    delete index['oat'];
    delete oat.gpxFile;
    oat.hasGpx = false;
    delete oat.trailHeadLat;
    delete oat.trailHeadLon;
    delete oat.durationMinutes;
  }
}

// ---- 2. rename bound files to <id>.gpx ------------------------------------
const targets = new Map(); // targetName -> trailId (collision detection)
for (const trailId of Object.keys(index)) {
  const target = uploadNameFor(trailId);
  if (targets.has(target) && targets.get(target) !== trailId) {
    problems.push(`FILENAME COLLISION: ${trailId} and ${targets.get(target)} both map to ${target} — resolve manually`);
    continue;
  }
  targets.set(target, trailId);
  const current = index[trailId];
  if (current === target && diskFiles.has(target)) continue; // already canonical
  const srcBuf = diskFiles.has(current) ? readIf(path.join(GPX_DIR, current)) : null;
  if (!srcBuf) {
    problems.push(`MISSING FILE: ${trailId} bound to "${current}" but it is not on disk — binding kept, flagged for validate`);
    continue;
  }
  const tgtPath = path.join(GPX_DIR, target);
  if (diskFiles.has(target)) {
    const tgtBuf = fs.readFileSync(tgtPath);
    if (sha1(tgtBuf) === sha1(srcBuf)) {
      note(`${trailId}: "${current}" == "${target}" (identical) — drop old name`);
      if (APPLY) fs.unlinkSync(path.join(GPX_DIR, current));
    } else {
      note(`${trailId}: "${target}" already exists with DIFFERENT bytes — old target quarantined, new file wins`);
      moveAside(target, `replaced by ${current} for ${trailId}`);
      if (APPLY) fs.renameSync(path.join(GPX_DIR, current), tgtPath);
    }
  } else {
    note(`${trailId}: "${current}" -> "${target}"`);
    if (APPLY) fs.renameSync(path.join(GPX_DIR, current), tgtPath);
    diskFiles.delete(current);
    diskFiles.add(target);
  }
  index[trailId] = target;
}

// ---- 3. trails.json <-> index sync ----------------------------------------
for (const t of trails) {
  const bound = index[t.id];
  if (bound) {
    if (t.gpxFile !== bound || t.hasGpx !== true) {
      note(`sync trail ${t.id}: gpxFile ${t.gpxFile || '(none)'} -> ${bound}`);
      t.gpxFile = bound;
      t.hasGpx = true;
    }
  } else if (t.gpxFile || t.hasGpx) {
    if (t.gpxFile && diskFiles.has(t.gpxFile)) {
      // file exists on disk but only trail record knows it — adopt into index
      const target = uploadNameFor(t.id);
      if (target !== t.gpxFile && diskFiles.has(target)) {
        problems.push(`CANNOT ADOPT ${t.id}: "${t.gpxFile}" not in index and "${target}" belongs to another trail`);
      } else {
        note(`adopt ${t.id}: gpxFile ${t.gpxFile} -> index (renamed ${target} if needed)`);
        if (target !== t.gpxFile) {
          if (APPLY) fs.renameSync(path.join(GPX_DIR, t.gpxFile), path.join(GPX_DIR, target));
          diskFiles.delete(t.gpxFile);
          diskFiles.add(target);
          index[t.id] = target;
          t.gpxFile = target;
        } else {
          index[t.id] = t.gpxFile;
        }
        t.hasGpx = true;
      }
    } else {
      note(`clear ${t.id}: gpxFile ${t.gpxFile || '(unset)'} -> (none, file not on disk)`);
      delete t.gpxFile;
      t.hasGpx = false;
    }
  }
}

// ---- 4. quarantine unreferenced files -------------------------------------
const referenced = new Set(Object.values(index));
for (const f of [...diskFiles].sort()) {
  if (!referenced.has(f)) moveAside(f, 'unreferenced after rename');
}

// ---- 5. byte-duplicate report across different trails ----------------------
{
  const byHash = new Map();
  for (const [id, file] of Object.entries(index)) {
    const buf = readIf(path.join(GPX_DIR, file));
    if (!buf) continue;
    const h = sha1(buf);
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(id);
  }
  for (const [h, ids] of byHash) {
    if (ids.length > 1) problems.push(`DUPLICATE GPX BYTES (${h.slice(0, 12)}…): ${ids.join(', ')}`);
  }
}

// ---- report & write --------------------------------------------------------
console.log(`\n${changes.length} change(s):`);
for (const c of changes) console.log('  ' + c);
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S) (no auto-fix):`);
  for (const p of problems) console.log('  ' + p);
}
const boundCount = Object.keys(index).length;
const hasGpxCount = trails.filter((t) => t.hasGpx).length;
console.log(`\nafter: ${boundCount} index bindings, ${hasGpxCount} trails with hasGpx, ${[...referenced].filter((f) => f && !problems.some((p) => p.includes(f))).length} referenced files`);
if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply.');
  process.exitCode = problems.length ? 2 : 0;
} else {
  fs.writeFileSync(TRAILS_FILE, JSON.stringify(trailsDoc, null, 2));
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  console.log('\nAPPLIED. Backups: *.bak-gpxfix + gpx_legacy_backup/.');
}
