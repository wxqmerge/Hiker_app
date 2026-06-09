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

// Escape special characters for TSV: tabs, newlines, backslashes
function escapeTsv(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
}

// Unescape TSV escape sequences
function unescapeTsv(str) {
  if (!str) return '';
  return str.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
}

// Export a single trail to TSV format matching the Excel hike page layout
// Field order mirrors cell positions: A0, B2, D2, G2, I2, B3, G3, B4, G4, Jan-Dec, A6, B13, B16, B19
export function exportTrailTsv(trail, detail) {
  const rows = [['Label', 'Value']];
  const add = (label, value) => rows.push([label, escapeTsv(String(value ?? ''))]);

  add('Trail Name', trail.fullName || trail.name);
  add('Distance', trail.distance ?? '');
  add('Distance Extended', trail.distanceExtended ?? '');
  add('Elevation Start', trail.elevationStart ?? '');
  add('Elevation Max', trail.elevationMax ?? '');
  add('Parking', trail.parking);
  add('Best Season', trail.seasonal?.bestSeason ?? '');
  add('Difficulty', trail.difficulty);
  add('Range', trail.range ?? '');

  const months = trail.seasonal?.availableMonths || [];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 12; i++) {
    add(MONTHS[i], months.includes(i + 1) ? 'Y' : '');
  }

  add('Description', detail?.fullDescription ?? '');
  add('Pros', detail?.pros ?? '');
  add('Other', detail?.others ?? '');
  add('Leaders', Array.isArray(detail?.leaders) ? detail.leaders.join(', ') : '');
  add('Alternate Names', Array.isArray(trail.altNames) ? trail.altNames.join(', ') : '');

  return rows.map(r => r.join('\t')).join('\n');
}

// Parse TSV back into trail + detail objects
export function parseTrailTsv(text) {
  const lines = text.split('\n');
  if (lines.length < 2) throw new Error('TSV file is empty or has only a header.');

  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const idx = lines[i].indexOf('\t');
    if (idx < 0) continue;
    const label = unescapeTsv(lines[i].substring(0, idx));
    const value = unescapeTsv(lines[i].substring(idx + 1));
    map[label] = value;
  }

  const parseNum = (v, fn) => {
    if (!v) return null;
    try { return fn(v); } catch { return null; }
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const availableMonths = [];
  for (let i = 0; i < 12; i++) {
    if (map[MONTHS[i]]?.trim()) availableMonths.push(i + 1);
  }

  const leaders = map['Leaders']?.trim()
    ? map['Leaders'].split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const altNames = map['Alternate Names']?.trim()
    ? map['Alternate Names'].split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const orderMap = { 'Easy': 1, 'Easy to Mod': 2, 'Moderate': 3, 'Mod to Diff': 4, 'Difficult': 5 };

  const trail = {
    name: map['Trail Name'] || '',
    fullName: map['Trail Name'] || '',
    distance: parseNum(map['Distance'], parseFloat),
    distanceExtended: parseNum(map['Distance Extended'], parseFloat),
    elevationStart: parseNum(map['Elevation Start'], v => parseInt(v, 10)),
    elevationMax: parseNum(map['Elevation Max'], v => parseInt(v, 10)),
    difficulty: map['Difficulty'] || 'Unknown',
    parking: map['Parking'] || '',
    range: map['Range'] || '',
    notes: map['Trail Name'] ? map['Trail Name'].substring(0, 200) : '',
    seasonal: {
      availableMonths,
      bestSeason: map['Best Season'] || '',
    },
    difficultyOrder: orderMap[map['Difficulty']] ?? 99,
    altNames: altNames.length > 0 ? altNames : undefined,
  };

  const detail = {
    fullDescription: map['Description'] || '',
    pros: map['Pros'] || null,
    others: map['Other'] || null,
    leaders: leaders.length > 0 ? leaders : [],
  };

  return { trail, detail };
}
