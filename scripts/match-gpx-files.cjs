const fs = require('fs');
const path = require('path');

const GPX_DIR = path.join(__dirname, '..', 'GPX');
const TRAILS_FILE = path.join(__dirname, '..', 'exported_data', 'trails.json');

const trailsData = JSON.parse(fs.readFileSync(TRAILS_FILE, 'utf-8'));
const trails = trailsData.trails;

const allFiles = fs.readdirSync(GPX_DIR);
const gpxFiles = allFiles.filter(f => f.endsWith('.gpx'));

// Words to ignore when scoring — group names, trail type descriptors
const NOISE_WORDS = new Set([
  'w', 'othh', 'ramblers', 'sotth', 'with', 'the', 'and', 'off', 'of',
  'at', 'from', 'to', 'via', 'near', 'a', 'in', 'on',
  'trail', 'trails', 'loop', 'walk', 'hike', 'drive', 'road', 'rd',
  'state', 'county', 'park', 'historical', 'conservation', 'area',
  'campground', 'reserve', 'beach', 'shore', 'spit',
  'morning', 'evening', 'afternoon',
]);

// Trail name aliases — extra keywords for fuzzy matching
// trailId → array of alternative names/keywords to match against
const TRAIL_ALIASES = {
  'barnes': ['bear creek', 'pearrygin lake'],
  'elwha-fish': ['elwha fishery', 'fish hatchery'],
  'w': ['west elwha', 'lower west elwha', 'elwha dam site'],
  'n': ['sol duc', 'sulduc', 'north fork'],
  'oat': ['reservoir', 'llama'],
  'little-humpbig': ['duckabush'],
  'mt-angeles': ['ellis creek', 'angeles foothills'],
  'mt': ['lake angeles', 'old angeles road'],
  'heather': ['heather park', 'halfway rock'],
};

// Tokenize a string into meaningful words for comparison
function tokenize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 1 && !NOISE_WORDS.has(w));
}

// Score how well a GPX file matches a trail (higher = better)
function scoreMatch(gpxFile, trail) {
  const gpxName = gpxFile.replace(/\.gpx$/i, '');
  const gpxTokens = tokenize(gpxName);

  // Combine trail name tokens with alias tokens
  let trailTokens = tokenize(trail.fullName || trail.name);
  const aliases = TRAIL_ALIASES[trail.id] || [];
  const aliasTokens = aliases.flatMap(a => tokenize(a));
  trailTokens = [...new Set([...trailTokens, ...aliasTokens])];

  if (gpxTokens.length === 0 || trailTokens.length === 0) return 0;

  // Count exact overlapping words
  const trailSet = new Set(trailTokens);
  const gpxSet = new Set(gpxTokens);
  let exactMatches = 0;
  for (const t of gpxSet) {
    if (trailSet.has(t)) exactMatches++;
  }

  // Count partial matches (one token contained in another)
  let partialMatches = 0;
  for (const gt of gpxSet) {
    for (const tt of trailSet) {
      if (gt !== tt && (gt.includes(tt) || tt.includes(gt))) {
        partialMatches++;
      }
    }
  }

  // Jaccard-like score
  const union = new Set([...gpxTokens, ...trailTokens]).size;
  const overlap = exactMatches / union;
  const partialBonus = partialMatches / union * 0.3;

  // Bonus if one name is contained in the other (normalized)
  const gpxStr = tokenize(gpxName).join(' ');
  const trailStr = tokenize(trail.fullName || trail.name).join(' ');
  let containmentBonus = 0;
  if (trailStr.includes(gpxStr) || gpxStr.includes(trailStr)) {
    containmentBonus = 0.2;
  }

  // Bonus for shared bigrams (two consecutive words)
  const gpxBigrams = new Set();
  for (let i = 0; i < gpxTokens.length - 1; i++) {
    gpxBigrams.add(`${gpxTokens[i]} ${gpxTokens[i + 1]}`);
  }
  const trailBigrams = new Set();
  for (let i = 0; i < trailTokens.length - 1; i++) {
    trailBigrams.add(`${trailTokens[i]} ${trailTokens[i + 1]}`);
  }
  let bigramMatches = 0;
  for (const bg of gpxBigrams) {
    if (trailBigrams.has(bg)) bigramMatches++;
  }
  const bigramBonus = bigramMatches * 0.1;

  return Math.min(overlap + partialBonus + containmentBonus + bigramBonus, 1.0);
}

// Match each GPX file to the best trail
const matches = [];
const unmatched = [];
const MIN_SCORE = 0.20;

for (const gpxFile of gpxFiles) {
  let bestTrail = null;
  let bestScore = 0;

  for (const trail of trails) {
    const s = scoreMatch(gpxFile, trail);
    if (s > bestScore) {
      bestScore = s;
      bestTrail = trail;
    }
  }

  if (bestScore >= MIN_SCORE && bestTrail) {
    matches.push({
      gpxFile,
      trailId: bestTrail.id,
      trailName: bestTrail.fullName || bestTrail.name,
      score: Math.round(bestScore * 100)
    });
  } else {
    unmatched.push({ gpxFile, bestScore: Math.round(bestScore * 100) });
  }
}

// Sort by score descending
matches.sort((a, b) => b.score - a.score);

console.log('=== GPX FILE MATCHES ===\n');
for (const m of matches) {
  const barLen = Math.floor(m.score / 10);
  const scoreBar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 10 - barLen));
  console.log(`${m.gpxFile.padEnd(55)} → ${m.trailName.padEnd(45)} [${scoreBar}] ${m.score}%`);
}

console.log(`\n=== UNMATCHED GPX FILES (${unmatched.length}) ===`);
for (const u of unmatched) {
  console.log(`  ${u.gpxFile} (best score: ${u.bestScore}%)`);
}

// Show potential conflicts (multiple GPX files → same trail)
const byTrail = {};
for (const m of matches) {
  if (!byTrail[m.trailId]) byTrail[m.trailId] = [];
  byTrail[m.trailId].push(m);
}
const conflicts = Object.entries(byTrail).filter(([, ms]) => ms.length > 1);
if (conflicts.length > 0) {
  console.log(`\n=== MULTIPLE GPX PER TRAIL (${conflicts.length} trails) ===`);
  for (const [id, ms] of conflicts) {
    console.log(`\n  ${id}:`);
    for (const m of ms) {
      console.log(`    ${m.gpxFile} (${m.score}%)`);
    }
  }
}

// Write matches for import
fs.writeFileSync(path.join(__dirname, 'gpx_matches.json'), JSON.stringify(matches, null, 2));
console.log(`\n${matches.length} matches written to gpx_matches.json`);
