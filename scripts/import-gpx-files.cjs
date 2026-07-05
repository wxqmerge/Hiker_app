const fs = require('fs');
const path = require('path');

const GPX_DIR = path.join(__dirname, '..', 'GPX');
const TRAILS_FILE = path.join(__dirname, '..', 'exported_data', 'trails.json');
const MATCHES_FILE = path.join(__dirname, 'gpx_matches.json');

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

// Import GPX data
let imported = 0;
let skipped = 0;

for (const [trailId, gpxFiles] of Object.entries(matchesByTrail)) {
  const trail = trailsData.trails.find(t => t.id === trailId);
  if (!trail) {
    console.log(`SKIP: Trail ${trailId} not found`);
    skipped++;
    continue;
  }
  
  // If trail already has GPX data, skip (unless we want to overwrite)
  if (trail.gpxData) {
    console.log(`SKIP: ${trail.fullName} already has GPX data`);
    skipped++;
    continue;
  }
  
  // Use the first GPX file (or largest if multiple)
  let selectedFile = gpxFiles[0];
  if (gpxFiles.length > 1) {
    // Pick the largest file (most detailed track)
    let maxSize = 0;
    for (const f of gpxFiles) {
      const size = fs.statSync(path.join(GPX_DIR, f)).size;
      if (size > maxSize) {
        maxSize = size;
        selectedFile = f;
      }
    }
  }
  
  // Read GPX content
  const gpxContent = fs.readFileSync(path.join(GPX_DIR, selectedFile), 'utf-8');
  
  // Validate it's actually a GPX file
  if (!gpxContent.includes('<gpx') && !gpxContent.includes('<?xml')) {
    console.log(`SKIP: ${selectedFile} doesn't appear to be valid GPX`);
    skipped++;
    continue;
  }
  
  // Set GPX data
  trail.gpxData = gpxContent;
  imported++;
  console.log(`IMPORT: ${trail.fullName} (${trailId}) ← ${selectedFile}`);
}

// Save updated trails
fs.writeFileSync(TRAILS_FILE, JSON.stringify(trailsData, null, 2));
console.log(`\nDone! Imported ${imported} GPX files, skipped ${skipped}`);
console.log(`Updated ${TRAILS_FILE}`);
