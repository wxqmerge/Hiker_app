import { formatTrailLine } from './formatTrail';
import { getGoogleAllTrailsSearchUrl } from './url.js';

// Generate formatted report text from trail data
// Format: Trail Name◆︎  [Difficulty]  distance / elevation  parking  ride-$X
//         [newline + description]
export function generateReportText(trail, trailDetails = null, earlyStart = false) {
  let name = trail.fullName || trail.name;
  name = name.replace(/◆\uFE0E?$/, '').replace(/◆+$/, '');

  const difficulty = `[${trail.difficulty}]`;
  let distanceText = trail.distance != null ? trail.distance.toFixed(1) : 'N/A';
  if (trail.distanceExtended) distanceText += `-${trail.distanceExtended.toFixed(1)}`;
  const elevStart = trail.elevationStart != null ? trail.elevationStart.toLocaleString() : '0';
  const elevMax = trail.elevationMax != null ? trail.elevationMax.toLocaleString() : elevStart;
  const elevationText = `${elevStart}'-${elevMax}'`;
  const parking = trail.parking || '';
  const rideCost = trail.range ? getRideCost(parseInt(trail.range, 10)) : '';

  let line = `${name}◆︎`;
  if (earlyStart) line += ' (Early Start)';
  line += `  ${difficulty}\t${distanceText} / ${elevationText}\t${parking}`;
  if (rideCost) line += `\t${rideCost}`;

  let report = line;

  // Append description if available
  if (trailDetails && trailDetails[trail.id]) {
    let description = trailDetails[trail.id].fullDescription || '';
    
    // Strip planner metadata (Pros, Others sections)
    description = stripPlannerMetadata(description);
    
    if (description.trim()) {
      report += '\n' + description.trim();
    }
  }
  
  // Append web link if available
  if (trail.webLink) {
    report += `\n\nLink: ${trail.webLink}\n`;
  } else {
    const searchUrl = getGoogleAllTrailsSearchUrl(trail.fullName || trail.name);
    if (searchUrl) {
      report += `\n\nLink: ${searchUrl}\n`;
    }
  }
  
  return report;
}

// Helper function to strip planner metadata from descriptions
function stripPlannerMetadata(text) {
  // Remove "Pros [content]" section (non-greedy, stops at "Others" or end)
  text = text.replace(/\s*Pros\s*.+?(?=\s*Others|$)/gi, '');
  // Remove "Others [content]" section
  text = text.replace(/\s*Others\s*.+/gi, '');
  return text.trim();
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
