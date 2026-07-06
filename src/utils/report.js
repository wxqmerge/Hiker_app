import { formatTrailLine, buildTrailLineParts } from './formatTrail';

// Escape HTML special characters
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Generate formatted report text from trail data
// Format: Trail Name◆︎  [Difficulty]  distance / elevation  parking  ride-$X
//         [newline + description]
export function generateReportText(trail, trailDetails = null, earlyStart = false) {
  const { name, difficulty, distanceText, elevationText, parking, rideCost } = buildTrailLineParts(trail);

  let line = `${name}◆︎`;
  if (earlyStart) line += ' (Early Start)';
  line += `  ${difficulty}\t${distanceText} / ${elevationText}\t${parking}`;
  if (rideCost) line += `\t${rideCost}`;

  let report = line;

  // Append description if available
  if (trailDetails && trailDetails[trail.id]) {
    const description = trailDetails[trail.id].fullDescription || '';
    if (description.trim()) {
      report += '\n' + description.trim();
    }
  }
  
  // Append web link if available (only DB links, no fallback search URL)
  if (trail.webLink) {
    report += `\n\nLink: ${trail.webLink}\n`;
  }
  if (trail.hasGpx) {
    report += '\nGPX: available\n';
  }

  return report;
}

// Generate HTML report for the monthly schedule
function buildTrailLineHtml(trail, earlyStart) {
  const { name, difficulty, distanceText, elevationText, parking, rideCost } = buildTrailLineParts(trail);

  let line = esc(`${name}◆︎`);
  if (earlyStart) line += ' <span class="early-start">(Early Start)</span>';
  line += `  ${esc(difficulty)}\t${esc(distanceText)} / ${esc(elevationText)}\t${esc(parking)}`;
  if (rideCost) line += `\t${esc(rideCost)}`;

  return line;
}

export function generateReportHtml(entries, title) {
  let sections = entries.map(entry => {
    const { dateStr, trail, trailDetails, earlyStart } = entry;

    if (!trail) {
      return `<div class="entry"><div class="entry-header">${esc(dateStr)}\tTBD</div></div>`;
    }

    let html = `<div class="entry">`;
    html += `<div class="entry-header">${esc(dateStr)}\t${buildTrailLineHtml(trail, earlyStart)}</div>`;

    // Description
    if (trailDetails && trailDetails[trail.id]) {
      const desc = trailDetails[trail.id].fullDescription || '';
      if (desc.trim()) {
        html += `<div class="entry-desc">${esc(desc.trim()).replace(/\n/g, '<br>')}</div>`;
      }
    }

    // Web link
    if (trail.webLink) {
      html += `<div class="entry-link"><a href="${esc(trail.webLink)}" target="_blank" rel="noopener noreferrer">${esc(trail.webLink)}</a></div>`;
    }
    if (trail.hasGpx) {
      html += '<div class="entry-gpx">GPX: available</div>';
    }

    html += `</div>`;
    return html;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5; margin: 40px; color: #222; }
  h1 { font-size: 24pt; font-weight: bold; font-family: Arial, sans-serif; margin-bottom: 30px; }
  .entry { margin-bottom: 28px; }
  .entry-header { font-size: 18pt; font-weight: bold; font-family: Arial, sans-serif; white-space: pre-wrap; }
  .early-start { color: red; }
  .entry-desc { font-size: 18pt; font-family: Arial, sans-serif; margin-top: 4px; white-space: pre-line; }
  .entry-link { font-size: 18pt; font-family: Arial, sans-serif; margin-top: 6px; }
  .entry-link a { color: blue; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
${sections}
</body>
</html>`;
}

// Convert range value to ride cost based on VBA formula:
// If hike_distance < 30 Then ride-$3
// ElseIf hike_distance < 60 Then ride-$5
// ElseIf hike_distance < 90 Then ride-$7
// Else ride-$10
export function getRideCost(range) {
  if (!range || range <= 0) return null;
  
  if (range < 30) {
    return 'ride-$3';
  } else if (range < 60) {
    return 'ride-$5';
  } else if (range < 90) {
    return 'ride-$7';
  } else {
    return 'ride-$10';
  }
}

// Copy text to clipboard
export async function copyToClipboard(text, setCopied, showToast) {
  try {
    await navigator.clipboard.writeText(text);
    if (setCopied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    if (showToast) showToast('Trail report copied to clipboard', 'success');
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    if (showToast) showToast('Failed to copy to clipboard', 'error');
    return false;
  }
}
