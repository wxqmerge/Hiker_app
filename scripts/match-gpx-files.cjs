const fs = require('fs');
const path = require('path');

const GPX_DIR = path.join(__dirname, '..', 'GPX');
const TRAILS_FILE = path.join(__dirname, '..', 'exported_data', 'trails.json');

const trailsData = JSON.parse(fs.readFileSync(TRAILS_FILE, 'utf-8'));
const trails = trailsData.trails;

const allFiles = fs.readdirSync(GPX_DIR);
const gpxFiles = allFiles.filter(f => f.endsWith('.gpx'));

// Direct mapping from GPX filename patterns to trail IDs
// Format: [regex pattern, trailId]
const directMatches = [
  [/360[_\s-]Road/i, '360'],
  [/Anderson[_\s-]Lake/i, 'anderson'],
  [/Aurora[_\s-]Creek/i, 'aurora'],
  [/Badger/i, 'badger'],
  [/Blyn[_\s-]Tower.*Uncas/i, 'blyn-tower'],
  [/Blyn/i, 'blyn'],
  [/Bogachiel/i, 'bogachiel'],
  [/Boulder[_\s-]Creek/i, 'boulder'],
  [/Borderline/i, 'borderline'],
  [/Burnt[_\s-]Hill.*Johnson/i, 'burnt'],
  [/Burnt[_\s-]Hill.*Louella/i, 'burnt-hill-from'],
  [/Burnt[_\s-]Hill.*cabin/i, 'burnt-hill'],
  [/Camp[_\s-]Handy/i, 'camp'],
  [/Cascade[_\s-]Rock/i, 'cascade'],
  [/Cassidy/i, 'cassidy'],
  [/Chetzemoka/i, 'chetzemoka'],
  [/Deer[_\s-]Hair/i, 'deer-hair'],
  [/Deer[_\s-]Lake[_\s-]Potholes/i, 'deer-lake'],
  [/Deer[_\s-]Ridge/i, 'slab-camp'],
  [/Dosewallips/i, 'dosewallips'],
  [/Dungeness.*Spit/i, 'dungeness-spit'],
  [/Dungeness.*dike/i, 'dungeness'],
  [/Dungeness.*Fish/i, 'dungeness-fish'],
  [/Dungeness.*Levee/i, 'dungeness-levee'],
  [/Dungeness/i, 'dungeness'],
  [/Eden[_\s-]Valley[_\s-]East/i, 'oat-eden'],
  [/Eden[_\s-]Valley[_\s-]West/i, 'oat-eden-valley'],
  [/Elis[_\s-]creek.*angeles/i, 'mt-angeles'],
  [/Elwha.*Beach/i, 'elwha'],
  [/Elwha.*dam.*east/i, 'elwha'],
  [/Elwha.*fishery/i, 'elwha-fish'],
  [/Elwha.*west/i, 'w'],
  [/Elwha/i, 'elwha'],
  [/Fort[_\s-]Flagler/i, 'fort-flagler'],
  [/Fort[_\s-]Townsend/i, 'fort'],
  [/Galloping[_\s-]Goose.*Victoria/i, 'victoriacanada'],
  [/Galloping[_\s-]Goose/i, 'victoriacanada'],
  [/Gibbs[_\s-]Lake/i, 'gibbs'],
  [/Gold[_\s-]Creek/i, 'gold'],
  [/Griff/i, 'griff'],
  [/Heather.*halfway/i, 'heather'],
  [/Heather[_\s-]Park/i, 'heather'],
  [/Horse.*living.*room/i, 'oat---mile'],
  [/Hansville/i, 'hansville'],
  [/Hurricane.*SnowShoe/i, 'hurricane-ridge'],
  [/Hurricane[_\s-]Ridge/i, 'hurricane-ridge'],
  [/Hurricane/i, 'hurricane'],
  [/Johnson[_\s-]Creek/i, 'burnt'],
  [/Karpen/i, 'karpen'],
  [/Larry[_\s-]Scott.*Milo/i, 'larry-scott'],
  [/Larry[_\s-]Scott/i, 'larry'],
  [/Little[_\s-]Hump.*Murhut/i, 'little-humpmurhut'],
  [/Little[_\s-]Hump/i, 'little-humpbig'],
  [/Little[_\s-]River/i, 'little-river'],
  [/Lovers[_\s-]Lane/i, 'lovers'],
  [/Lower[_\s-]Grey[_\s-]Wolf/i, 'oldlower'],
  [/Lyre[_\s-]River/i, 'lyre'],
  [/M0.*living.*room/i, 'oat---mile'],
  [/Miller.*ESB/i, 'miller-peninsula'],
  [/Miller.*Thompson/i, 'miller-peninsula-to'],
  [/Miller/i, 'miller'],
  [/Mink[_\s-]Lake/i, 'mink'],
  [/Mt[_\s-]Townsend/i, 'mt-townsend'],
  [/Mt[_\s-]Walker/i, 'mt-walker'],
  [/Mt[_\s-]Zion/i, 'mt-zion'],
  [/Murhut/i, 'little-humpmurhut'],
  [/N[_\s-]Sulduc/i, 'n'],
  [/Ned[_\s-]Hill/i, 'ned'],
  [/Newberry[_\s-]Hill/i, 'newberry'],
  [/North[_\s-]Kitsap/i, 'n-kitsap'],
  [/OAT/i, 'oat'],
  [/Old[_\s-]Angeles/i, 'mt'],
  [/Othh[_\s-]Reservoir/i, 'oat'],
  [/Ozette.*Triangle/i, 'ozette'],
  [/Pats[_\s-]Prairie/i, 'pats'],
  [/Peabody/i, 'peabody'],
  [/Ranger[_\s-]Hole/i, 'little-humpmurhut'],
  [/Royal[_\s-]Basin/i, 'royal-lakebasin'],
  [/Royal[_\s-]Creek/i, 'royal'],
  [/Slide[_\s-]Camp/i, 'slab-camp-to-slide'],
  [/Slab[_\s-]Camp.*Duncan/i, 'slab-camp-to'],
  [/Slab[_\s-]Camp/i, 'slab'],
  [/Sleepy[_\s-]Hollow/i, 'sleepy'],
  [/Snider[_\s-]Ridge/i, 'snider'],
  [/Spruce.*East/i, 'spruce'],
  [/Spruce.*West/i, 'spruce-rr'],
  [/Steam[_\s-]Donkey.*Maple/i, 'steam'],
  [/Steam[_\s-]Donkey/i, 'steam'],
  [/Storm[_\s-]King/i, 'storm'],
  [/Teal/i, 'teal'],
  [/Thompson[_\s-]Spit/i, 'miller-peninsula-to'],
  [/Timberton/i, 'timberton'],
  [/Tubal[_\s-]Cain/i, 'tubal'],
  [/Tunnel[_\s-]Creek/i, 'tunnel'],
  [/Verne[_\s-]Samuelson/i, 'verne'],
  [/Victoria.*Canada/i, 'victoriacanada'],
  [/Victoria.*Galloping/i, 'victoriacanada'],
  [/West[_\s-]Elwha/i, 'w'],
  [/Bear[_\s-]Creek.*Pearrygin/i, 'barnes'],
  [/Ellis[_\s-]creek.*angeles/i, 'mt-angeles'],
];

function matchTrail(gpxFile) {
  for (const [pattern, trailId] of directMatches) {
    if (pattern.test(gpxFile)) {
      const trail = trails.find(t => t.id === trailId);
      if (trail) {
        return { trail, score: 100 };
      }
    }
  }
  return null;
}

const matches = [];
const unmatched = [];

for (const gpxFile of gpxFiles) {
  const match = matchTrail(gpxFile);
  if (match) {
    matches.push({
      gpxFile,
      trailId: match.trail.id,
      trailName: match.trail.fullName || match.trail.name,
      score: match.score
    });
  } else {
    unmatched.push(gpxFile);
  }
}

console.log('=== GPX FILE MATCHES ===\n');
for (const m of matches) {
  console.log(`${m.gpxFile.padEnd(50)} → ${m.trailName} (${m.trailId})`);
}

console.log(`\n=== UNMATCHED GPX FILES (${unmatched.length}) ===`);
for (const f of unmatched) {
  console.log(`  ${f}`);
}

// Write matches for import
fs.writeFileSync(path.join(__dirname, 'gpx_matches.json'), JSON.stringify(matches, null, 2));
console.log(`\n${matches.length} matches written to gpx_matches.json`);
