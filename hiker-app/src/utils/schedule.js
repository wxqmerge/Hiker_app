// Parse Excel schedule file and match hikes to trails
import * as XLSX from 'xlsx';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseScheduleFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const allHikes = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Find header row
    let headerRow = null;
    for (let i = 0; i < Math.min(6, rows.length); i++) {
      if (rows[i] && rows[i][0] === 'Month') {
        headerRow = i;
        break;
      }
    }
    if (headerRow === null) continue;

    // Detect column structure
    const numCols = rows[0] ? rows[0].length : 0;
    let cols;
    if (numCols >= 10) {
      cols = [
        { m: 0, d: 1, h: 2, l: 3 },  // Wed: Month, Wed, Hike, Leader
        { m: 5, d: 6, h: 7, l: 8 }   // Fri: Month, Fri, Hike, Leader
      ];
    } else if (numCols >= 9) {
      cols = [
        { m: 0, d: 1, h: 2, l: 3 },
        { m: 4, d: 5, h: 6, l: 7 }
      ];
    } else if (numCols >= 6) {
      cols = [
        { m: 0, d: 1, h: 2, l: -1 },
        { m: 3, d: 4, h: 5, l: -1 }
      ];
    } else {
      continue;
    }

    let currentMonth = null;
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some(c => c !== '' && c !== null && c !== undefined)) continue;

      // Skip "Alternate" section
      const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
      if (rowStr.includes('alternate') || rowStr.includes('note:')) continue;

      for (const c of cols) {
        const monthVal = String(row[c.m] || '').trim();
        const dayVal = String(row[c.d] || '').trim();
        const hikeVal = String(row[c.h] || '').trim();
        const leaderVal = c.l >= 0 ? String(row[c.l] || '').trim() : '';

        if (MONTH_ABBR.includes(monthVal)) {
          currentMonth = monthVal;
        }
        if (!hikeVal || !currentMonth) continue;

        // Skip invalid hikes
        if (/^[\d.]+$/.test(hikeVal)) continue;
        if (/^(tbd|tba|cancel|canceled)/i.test(hikeVal)) continue;
        if (hikeVal.toLowerCase() === 'month' || hikeVal.toLowerCase() === 'hike') continue;

        // Skip if day is not a number
        const day = parseFloat(dayVal);
        if (isNaN(day)) continue;

        allHikes.push({
          month: currentMonth,
          day: day,
          hike: hikeVal,
          leader: leaderVal,
          sheet: sheetName
        });
      }
    }
  }

  return allHikes;
}

export function matchHike(hikeName, trails) {
  const hikeNorm = normalize(hikeName);
  const hikeWords = hikeNorm.split(/\s+/).filter(w => w.length > 1);

  const allHikeWords = [...hikeWords];

  let bestMatch = null;
  let bestScore = 0;

  for (const t of trails) {
    const fullName = normalize(t.fullName || '');
    const name = normalize(t.name || '');
    const allText = fullName + ' ' + name;

    let score = 0;
    for (const word of allHikeWords) {
      if (allText.includes(word)) {
        score += word.length;
      }
    }

    if (hikeNorm.includes(allText) || allText.includes(hikeNorm)) {
      score += 20;
    }

    for (const word of allHikeWords) {
      if (word.length > 3 && (t.name || '').toLowerCase().includes(word)) {
        score += 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = t;
    }
  }

  if (bestScore < 4) return null;
  return bestMatch;
}

function normalize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function generateFormattedText(monthHikes, trails, trailDetails) {
  const monthNames = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };

  if (monthHikes.length === 0) return '';

  const month = monthHikes[0].month;
  let output = `Over-the-Hill Hike Descriptions -- ${monthNames[month] || month}, 2026\n`;

  for (const hike of monthHikes) {
    const trail = matchHike(hike.hike, trails);
    const dayName = hike.day % 10 === 1 && hike.day !== 11 ? 'st' : hike.day % 10 === 2 && hike.day !== 12 ? 'nd' : hike.day % 10 === 3 && hike.day !== 13 ? 'rd' : 'th';
    const dayOfWeek = hike.day % 10 <= 3 && ['Wed', 'Fri'].includes(hike.day % 10 <= 3 ? (hike.day === 1 || hike.day === 8 || hike.day === 15 || hike.day === 22 || hike.day === 29 ? 'Wed' : 'Fri') : 'Wed') ? (hike.day === 1 || hike.day === 8 || hike.day === 15 || hike.day === 22 || hike.day === 29 ? 'Wed' : 'Fri') : '';

    let name = hike.hike;
    if (trail) {
      name = trail.fullName || trail.name;
      // Strip trailing diamond
      name = name.replace(/◆\uFE0E?$/, '').replace(/◆+$/, '');

      const difficulty = `[${trail.difficulty}]`;
      let distanceText = trail.distance != null ? trail.distance.toFixed(1) : 'N/A';
      if (trail.distanceExtended) distanceText += `-${trail.distanceExtended.toFixed(1)}`;
      const elevStart = trail.elevationStart != null ? trail.elevationStart.toLocaleString() : '0';
      const elevMax = trail.elevationMax != null ? trail.elevationMax.toLocaleString() : elevStart;
      const elevationText = `${elevStart}'-${elevMax}'`;
      const parking = trail.parking || '';
      const rideCost = trail.range ? getRideCost(parseInt(trail.range)) : '';

      output += `${dayOfWeek}, ${month} ${hike.day}\t${name}◆︎  ${difficulty}\t${distanceText} / ${elevationText}\t${parking}`;
      if (rideCost) output += `\t${rideCost}`;
      output += '\n';

      // Add description
      if (trailDetails && trailDetails[trail.id]) {
        let desc = trailDetails[trail.id].fullDescription || '';
        desc = desc.replace(/\s*Pros\s*.+?(?=\s*Others|$)/gi, '').replace(/\s*Others\s*.+/gi, '').trim();
        if (desc) output += desc + '\n';
      }
    } else {
      output += `${dayOfWeek}, ${month} ${hike.day}\t${hike.hike}\t(No match)\n`;
    }
    output += '\n';
  }

  return output;
}

function getRideCost(range) {
  if (!range || range <= 0) return null;
  if (range < 30) return 'ride-$3';
  if (range < 60) return 'ride-$5';
  if (range < 90) return 'ride-$7';
  return 'ride-$10';
}
