import { getRideCost } from './report';
import { getTrailName } from './data';
 
 // Build structured trail line parts from a trail object
export function buildTrailLineParts(trail) {
  let name = getTrailName(trail);
  name = name.replace(/^◆\uFE0E?\s*/, '').replace(/◆\uFE0E?$/, '').replace(/◆+$/, '').trim();
 
   const difficulty = `[${trail.difficulty}]`;
    let distanceText = trail.distance != null ? Number(trail.distance).toFixed(1) : 'N/A';
    if (trail.distanceExtended != null) distanceText += `-${Number(trail.distanceExtended).toFixed(1)}`;
   const elevStart = trail.elevationStart != null ? trail.elevationStart.toLocaleString() : '0';
   const elevMax = trail.elevationMax != null ? trail.elevationMax.toLocaleString() : elevStart;
   const elevationText = `${elevStart}'-${elevMax}'`;
   const parking = trail.parking || '';
   const rideCost = trail.range ? getRideCost(parseInt(trail.range, 10)) : '';
 
   return { name, difficulty, distanceText, elevationText, parking, rideCost };
 }
