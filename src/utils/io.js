// Download a blob as a file
export function downloadBlob(data, filename, type = 'application/json') {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Create a hidden file input, trigger it, and call onFile with the selected file
export function createFileInput({ accept, onFile, onCleanup }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  input.onchange = () => {
    if (!input.files?.[0]) return;
    onFile(input.files[0]);
    document.body.removeChild(input);
    onCleanup?.();
  };
  document.body.appendChild(input);
  input.click();
}

// Returns a file input element that triggers a callback with parsed JSON
export function createImportFileInput(onImport, onError) {
  createFileInput({
    accept: '.json',
    onFile: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          onImport(imported);
        } catch {
          onError?.('Error importing file: Invalid JSON format');
        }
      };
      reader.readAsText(file);
    },
  });
}

// Export a single trail to TSV format matching the Excel hike page layout exactly.
// Output is a raw cell dump: 20 rows x 9 columns (A-I), tabs between columns.
// Cell positions:
//   A0=Trail Name, B2=Distance, D2=Dist Extended, G2=Elev Start, I2=Elev Max
//   B3=Parking, G3=Best Season, B4=Level, G4=Range
//   A6=Description, B14=Pros, B16=Other, B19=Leaders
export function exportTrailTsv(trail, detail) {
  const r = (len = 9) => Array(len).fill('');
  const grid = [];

  // Row 0: Trail Name
  grid.push([...r()]);
  grid[0][0] = trail.fullName || trail.name || '';

  // Row 1: empty
  grid.push([...r()]);

  // Row 2: Miles & Elevation
  grid.push([...r()]);
  grid[2][0] = 'Miles';
  grid[2][1] = trail.distance ?? '';
  grid[2][2] = 'to';
  grid[2][3] = trail.distanceExtended ?? '';
  grid[2][5] = 'Elevation';
  grid[2][6] = trail.elevationStart ?? '';
  grid[2][7] = 'to';
  grid[2][8] = trail.elevationMax ?? '';

  // Row 3: Parking & Season
  grid.push([...r()]);
  grid[3][0] = 'Parking';
  grid[3][1] = trail.parking || '';
  grid[3][5] = 'Season';
  grid[3][6] = trail.seasonal?.bestSeason || '';

  // Row 4: Level & Range
  grid.push([...r()]);
  grid[4][0] = 'Level';
  grid[4][1] = trail.difficulty || '';
  grid[4][5] = 'Range';
  grid[4][6] = trail.range ?? '';

  // Row 5: General Information
  grid.push([...r()]);
  grid[5][0] = 'General Information';

  // Row 6: Description
  grid.push([...r()]);
  grid[6][0] = detail?.fullDescription || '';

  // Rows 7-13: empty
  for (let i = 7; i <= 13; i++) grid.push([...r()]);

  // Row 14: Pros
  grid.push([...r()]);
  grid[14][0] = 'Pros';
  grid[14][1] = detail?.pros || '';

  // Row 15: empty
  grid.push([...r()]);

  // Row 16: Other
  grid.push([...r()]);
  grid[16][0] = 'Other';
  grid[16][1] = detail?.others || '';

  // Rows 17-18: empty
  for (let i = 17; i <= 18; i++) grid.push([...r()]);

  // Row 19: Leaders
  grid.push([...r()]);
  grid[19][0] = 'Leaders';
  grid[19][1] = Array.isArray(detail?.leaders) ? detail.leaders.join(', ') : '';

  return grid.map(row => row.join('\t')).join('\n');
}

// Parse TSV in the raw Excel cell layout format back into trail + detail objects.
// Expects 20 rows x 9 columns (A-I), tabs between columns.
export function parseTrailTsv(text) {
  const lines = text.split('\n').map(l => l.split('\t'));
  if (lines.length < 20) throw new Error('TSV file must have 20 rows.');

  const cell = (row, col) => (lines[row]?.[col] || '').trim();
  const parseNum = (v, fn) => {
    if (!v) return null;
    try { return fn(v); } catch { return null; }
  };

  const trailName = cell(0, 0);
  const distance = parseNum(cell(2, 1), parseFloat);
  const distanceExtended = parseNum(cell(2, 3), parseFloat);
  const elevationStart = parseNum(cell(2, 6), v => parseInt(v, 10));
  const elevationMax = parseNum(cell(2, 8), v => parseInt(v, 10));
  const parking = cell(3, 1);
  const bestSeason = cell(3, 6);
  const level = cell(4, 1);
  const range = cell(4, 6);
  const description = lines.slice(6, 13).map(l => (l[0] || '').trim()).filter(Boolean).join(' ');
  const pros = cell(14, 1) || null;
  const others = cell(16, 1) || null;
  const leadersRaw = cell(19, 1);
  const leaders = leadersRaw
    ? leadersRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const orderMap = { 'Easy': 1, 'Easy to Mod': 2, 'Moderate': 3, 'Mod to Diff': 4, 'Difficult': 5 };

  const trail = {
    name: trailName || '',
    fullName: trailName || '',
    distance,
    distanceExtended,
    elevationStart,
    elevationMax,
    difficulty: level || 'Unknown',
    parking,
    range: range || '',
    notes: trailName ? trailName.substring(0, 200) : '',
    seasonal: {
      availableMonths: [],
      bestSeason,
    },
    difficultyOrder: orderMap[level] ?? 99,
  };

  const detail = {
    fullDescription: description || '',
    pros,
    others,
    leaders,
  };

  return { trail, detail };
}
