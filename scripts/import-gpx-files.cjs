const fs = require('fs');
const path = require('path');

const GPX_DIR = path.join(__dirname, '..', 'GPX');
const TRAILS_FILE = path.join(__dirname, '..', 'exported_data', 'trails.json');
const MATCHES_FILE = path.join(__dirname, 'gpx_matches.json');
const INDEX_FILE = path.join(__dirname, '..', 'exported_data', 'gpx_index.json');
const GPX_UPLOAD_DIR = path.join(__dirname, '..', 'exported_data', 'gpx');

// Load data
const trailsData = JSON.parse(fs.readFileSync(TRAILS_FILE, 'utf-8'));
const matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf-8'));

// Group matches by trail ID (some trails have multiple GPX files)
const matchesByTrail = {};
for (const m of matches) {
  if (!matchesByTrail[m.trailId]) {
    matchesByTrail[m.trailId] = [];
  }
  matchesByTrail[m.trailId].push(m.gpxFile);
}

// Build gpx_index: trailId -> gpx filename
const gpxIndex = {};
let imported = 0;
let skipped = 0;

for (const [trailId, gpxFiles] of Object.entries(matchesByTrail)) {
  const trail = trailsData.trails.find(t => t.id === trailId);
  if (!trail) {
    console.log(`SKIP: Trail ${trailId} not found`);
    skipped++;
    continue;
  }

  // Filter to only files that actually exist on disk
  const existingFiles = gpxFiles.filter(f => fs.existsSync(path.join(GPX_DIR, f)));
  if (existingFiles.length === 0) {
    console.log(`SKIP: ${trail.fullName} — none of ${gpxFiles.length} matched GPX files exist on disk`);
    skipped++;
    continue;
  }

  // Pick the largest existing file (most detailed track)
  let selectedFile = existingFiles[0];
  if (existingFiles.length > 1) {
    let maxSize = 0;
    for (const f of existingFiles) {
      const size = fs.statSync(path.join(GPX_DIR, f)).size;
      if (size > maxSize) {
        maxSize = size;
        selectedFile = f;
      }
    }
  }

  // Set hasGpx flag on trail, remove old gpxData
  trail.hasGpx = true;
  delete trail.gpxData;

  // Add to index
  gpxIndex[trailId] = selectedFile;
  imported++;
  console.log(`INDEX: ${trail.fullName} (${trailId}) ← ${selectedFile}`);
}

// Clear hasGpx for trails not in the index, and migrate any remaining embedded gpxData to files
for (const trail of trailsData.trails) {
  if (trail.gpxData) {
    // Migrate embedded GPX to file-based storage
    fs.mkdirSync(GPX_UPLOAD_DIR, { recursive: true });
    const gpxFilePath = path.join(GPX_UPLOAD_DIR, `${trail.id}.gpx`);
    fs.writeFileSync(gpxFilePath, trail.gpxData, 'utf-8');
    gpxIndex[trail.id] = `${trail.id}.gpx`;
    trail.hasGpx = true;
    console.log(`MIGRATE: ${trail.fullName} (${trail.id}) → ${trail.id}.gpx`);
  }
  if (!gpxIndex[trail.id]) {
    trail.hasGpx = false;
  }
  delete trail.gpxData;
}

// Save updated trails (without embedded GPX)
fs.writeFileSync(TRAILS_FILE, JSON.stringify(trailsData, null, 2));

// Save gpx index
fs.writeFileSync(INDEX_FILE, JSON.stringify(gpxIndex, null, 2));

console.log(`\nDone! Indexed ${imported} GPX files, skipped ${skipped}`);
console.log(`Updated ${TRAILS_FILE} (GPX data removed)`);
console.log(`Created ${INDEX_FILE}`);
