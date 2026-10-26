const fs = require('fs');
const path = require('path');

const TRAIL_DETAILS_FILE = path.join(__dirname, '..', 'exported_data', 'trail_details.json');
const TRAILS_FILE = path.join(__dirname, '..', 'exported_data', 'trails.json');

const details = JSON.parse(fs.readFileSync(TRAIL_DETAILS_FILE, 'utf-8'));
const trailsData = JSON.parse(fs.readFileSync(TRAILS_FILE, 'utf-8'));

let updated = 0;

const urlRegex = /https?:\/\/\S+/g;

for (const [id, detail] of Object.entries(details)) {
  const desc = detail.fullDescription || '';
  const urls = desc.match(urlRegex);
  if (!urls || urls.length === 0) continue;

  const trail = trailsData.trails.find(t => t.id === id);
  if (!trail) {
    console.log(`Warning: trail ${id} not found in trails.json, skipping`);
    continue;
  }

  const url = urls[0];

  // Set webLink if not already present
  if (!trail.webLink) {
    trail.webLink = url;
  }

  // Remove URL from description
  detail.fullDescription = desc.replace(urlRegex, '').replace(/\s{2,}/g, ' ').trim();

  updated++;
  console.log(`Trail ${id}: ${trail.webLink}`);
}

fs.writeFileSync(TRAIL_DETAILS_FILE, JSON.stringify(details, null, 2) + '\n', 'utf-8');
fs.writeFileSync(TRAILS_FILE, JSON.stringify(trailsData, null, 2) + '\n', 'utf-8');

console.log(`\nDone. Updated ${updated} trail(s).`);
