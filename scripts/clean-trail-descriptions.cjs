const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'exported_data', 'trail_details.json');

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

let updated = 0;

for (const [id, detail] of Object.entries(data)) {
  if (!detail.fullDescription) continue;

  let desc = detail.fullDescription;
  const match = desc.match(/\s*Pros\s*(.*?)\s*Other\s*(.*)$/is);

  if (!match) continue;

  const prosContent = match[1].trim();
  const othersContent = match[2].trim();

  // Append extracted content to existing fields
  if (prosContent) {
    detail.pros = (detail.pros ? detail.pros + ' ' : '') + prosContent;
  }
  if (othersContent) {
    detail.others = (detail.others ? detail.others + ' ' : '') + othersContent;
  }

  // Remove the "Pros ... Other ..." artifact from description
  desc = desc.replace(/\s*Pros\s*(.*?)\s*Other\s*(.*)$/is, '');
  detail.fullDescription = desc.trim();

  updated++;
}

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Done. Cleaned up ${updated} trail description(s).`);
