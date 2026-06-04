const fs = require('fs');
const trails = require('./exported_data/trails.json').trails;
const trailDetails = require('./exported_data/trail_details.json');

function normalize(s) {
  return s.replace(/\u25C6\uFE0E/g, '')
          .replace(/\s+/g, ' ')
          .replace(/\s\(Early Start\)/gi, '')
          .replace(/^\*/, '')
          .replace(/[\/]/g, ' ')
          .replace(/\s+/g, ' ')
          .toLowerCase().trim();
}

const trailMap = {};
trails.forEach(t => {
  trailMap[normalize(t.fullName)] = t;
  trailMap[normalize(t.name)] = t;
  if (t.altNames) t.altNames.forEach(a => { trailMap[normalize(a)] = t; });
});

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const hikes = [];
const content = fs.readFileSync('3Q26_hikes.tsv', 'utf8');
const lines = content.split('\n');

let currentMonth = -1;

lines.forEach(line => {
  const cols = line.split('\t');
  if (cols.length < 8) return;

  const wedHike = (cols[2] || '').trim();
  const friHike = (cols[7] || '').trim();
  if (!wedHike && !friHike) return;
  if (wedHike === 'Hike' || friHike === 'Hike') return;
  if (wedHike.includes('Alternate') || friHike.includes('Alternate')) return;

  const monthStr = cols[0].trim();
  if (monthStr) {
    const m = MONTH_NAMES.indexOf(monthStr);
    if (m >= 0) currentMonth = m;
  }
  if (currentMonth < 0) return;

  if (wedHike) {
    const day = parseInt(cols[1].trim());
    if (day > 0) {
      hikes.push({ month: currentMonth, day, hike: wedHike, leader: (cols[3]||'').trim(), date: new Date(2026, currentMonth, day) });
    }
  }

  if (friHike) {
    const day = parseInt(cols[6].trim());
    if (day > 0) {
      hikes.push({ month: currentMonth, day, hike: friHike, leader: (cols[8]||'').trim(), date: new Date(2026, currentMonth, day) });
    }
  }
});

hikes.sort((a, b) => a.date - b.date);

let output = 'Over-the-Hill Hike Descriptions -- 3rd Quarter 2026\n\n';

hikes.forEach(h => {
  const dayOfWeek = DAY_NAMES[h.date.getDay()];
  const monthName = MONTH_NAMES[h.month];
  const matched = trailMap[normalize(h.hike)];

  let description;
  if (matched) {
    const trail = matched;
    const details = trailDetails[trail.id] || null;

    let parts = [];
    let name = trail.fullName || trail.name;
    if (trail.difficulty === 'Hard') name += '\u25C6';
    parts.push(name);
    parts.push(trail.difficulty || 'TBD');

    let dist = '';
    if (trail.distance) {
      dist = trail.distance + ' mi';
      if (trail.distanceExtended) dist += ' / ' + trail.distanceExtended + ' mi';
    }
    parts.push(dist || 'TBD');

    let elev = '';
    if (trail.elevationStart) elev += trail.elevationStart + ' ft';
    if (trail.elevationMax) elev += ' / ' + trail.elevationMax + ' ft';
    parts.push(elev || 'TBD');

    parts.push(trail.parking || 'TBD');

    let rideCost = 'TBD';
    if (trail.range) {
      const r = parseInt(trail.range);
      if (r < 30) rideCost = 'ride-$3';
      else if (r < 60) rideCost = 'ride-$5';
      else if (r < 90) rideCost = 'ride-$7';
      else rideCost = 'ride-$10';
    }
    parts.push(rideCost);

    description = parts.join('  ');

    if (details && details.fullDescription) {
      let desc = details.fullDescription;
      desc = desc.replace(/\s*Pros\s*.+?(?=\s*Others|$)/gi, '');
      desc = desc.replace(/\s*Others\s*.+/gi, '');
      if (desc.trim()) description += '\n' + desc.trim();
    }
  } else {
    description = 'TBD';
  }

  output += `${dayOfWeek}, ${monthName} ${h.day}\t${h.hike}\t${h.leader}\t${description}\n\n`;
});

fs.writeFileSync('3Q26_schedule.txt', output);
console.log('Written', hikes.length, 'hikes to 3Q26_schedule.txt');
