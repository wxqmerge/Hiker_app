import { getRideCost } from './report';

// Format trail core info for text output
export function formatTrailLine(trail) {
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

  let line = `${name}◆︎  ${difficulty}\t${distanceText} / ${elevationText}\t${parking}`;
  if (rideCost) line += `\t${rideCost}`;

  return line;
}
