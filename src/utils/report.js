import { buildTrailLineParts } from './formatTrail';
import { getTrailName } from './data';
import { normalizeStartOffset } from './etc';
import { DAY_NAMES, MONTH_ABBR } from './constants';
import { safeWebLink } from './url';

// Escape HTML special characters
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Build description + web link + GPX HTML snippet for a trail.
// mode "compact" → monthly report classes; mode "card" → single-trail classes
function buildTrailDetailsHtml(trail, trailDetails, mode = 'compact') {
  let html = '';

  if (trailDetails && trailDetails[trail.id]) {
    const desc = trailDetails[trail.id].fullDescription || '';
    if (desc.trim()) {
      if (mode === 'compact') {
        html += `<div class="entry-desc">${esc(desc.trim()).replace(/\n/g, '<br>')}</div>`;
      } else {
        html += `<div class="section"><h2>Description</h2><p>${esc(desc.trim())}</p></div>`;
      }
    }
  }

  if (trail.notes && mode !== 'compact') {
    html += `<div class="section"><h2>Notes</h2><p>${esc(trail.notes)}</p></div>`;
  }

  const safeLink = safeWebLink(trail.webLink);
  if (safeLink) {
    if (mode === 'compact') {
      html += `<div class="entry-link"><a href="${esc(safeLink)}" target="_blank" rel="noopener noreferrer">${esc(trail.webLink)}</a></div>`;
    } else {
      html += `<div class="section"><h2>Web Link</h2><p><a href="${esc(safeLink)}" class="link" target="_blank" rel="noopener noreferrer">${esc(trail.webLink)}</a></p></div>`;
    }
  }

  if (trail.hasGpx) {
    if (mode === 'compact') {
      html += '<div class="entry-gpx">GPX: available</div>';
    } else {
      html += `<div class="section"><h2>GPX</h2><p>Available</p></div>`;
    }
  }

  return html;
}

// Generate HTML report for the monthly schedule
function buildTrailLineHtml(trail, earlyStart) {
  const { name, difficulty, distanceText, elevationText, parking, rideCost } = buildTrailLineParts(trail);

  // ◆ marks wilderness trails only — same predicate as the filter/sort
  // (name carries the ◆); buildTrailLineParts strips it from `name`.
  const wilderness = getTrailName(trail).includes('\u25C6');
  let line = esc(wilderness ? `${name}\u25C6\uFE0E` : name);
  const offset = normalizeStartOffset(earlyStart);
  if (offset !== 0) {
    const label = offset < 0 ? `${Math.abs(offset)}m early` : `${offset}m late`;
    line += ` <span class="early-start">(${label})</span>`;
  }
  line += `  ${esc(difficulty)}\t${esc(distanceText)} / ${esc(elevationText)}\t${esc(parking)}`;
  if (rideCost) line += `\t${esc(rideCost)}`;

  return line;
}

// One report entry (bold date/header line + description/link/GPX block).
// Shared by the monthly report and the printable descriptions sheet.
function renderEntryHtml({ dateStr, trail, trailDetails, earlyStart }) {
  if (!trail) {
    return `<div class="entry"><div class="entry-header">${esc(dateStr)}\tTBD</div></div>`;
  }
  let html = `<div class="entry">`;
  html += `<div class="entry-header">${esc(dateStr)}\t${buildTrailLineHtml(trail, earlyStart)}</div>`;
  html += buildTrailDetailsHtml(trail, trailDetails, 'compact');
  html += `</div>`;
  return html;
}

export function generateReportHtml(entries, title) {
  let sections = entries.map(renderEntryHtml).join('');

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

// Printable hike-descriptions sheet modeled on the old Google Sites page:
// month sections of report entries + footer notes, print CSS that hides the
// on-screen toolbar and keeps entries from splitting across pages.
// monthGroups: [{ label, entries: [{ dateStr, trail, trailDetails, earlyStart }] }]
// notes: [{ heading, text }]
export function generateDescriptionsPrintHtml({ title, monthGroups, notes = [] }) {
  const sections = monthGroups.map(group => {
    const body = group.entries.length
      ? group.entries.map(renderEntryHtml).join('')
      : '<p class="empty">No hikes scheduled.</p>';
    return `<h2 class="month">${esc(group.label)}</h2>${body}`;
  }).join('');

  const notesHtml = notes.length
    ? `<div class="notes">${notes.map(n => `<p><b>${esc(n.heading)}</b> ${esc(n.text)}</p>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5; margin: 40px; color: #222; }
  h1 { font-size: 24pt; font-weight: bold; font-family: Arial, sans-serif; margin-bottom: 30px; }
  h2.month { font-size: 20pt; font-weight: bold; font-family: Arial, sans-serif; margin: 26px 0 14px; }
  .entry { margin-bottom: 28px; }
  .entry-header { font-size: 18pt; font-weight: bold; font-family: Arial, sans-serif; white-space: pre-wrap; }
  .early-start { color: red; }
  .entry-desc { font-size: 18pt; font-family: Arial, sans-serif; margin-top: 4px; white-space: pre-line; }
  .entry-link { font-size: 18pt; font-family: Arial, sans-serif; margin-top: 6px; }
  .entry-link a { color: blue; }
  .empty { font-size: 18pt; }
  .notes { margin-top: 32px; font-size: 13pt; line-height: 1.5; }
  .toolbar { position: sticky; top: 0; background: #fff; padding: 8px 0; margin-bottom: 12px; border-bottom: 1px solid #ddd; }
  .toolbar button { font: inherit; font-size: 14px; padding: 6px 14px; border: 1px solid #2e7d32; border-radius: 6px; background: #fff; color: #2e7d32; cursor: pointer; }
  .toolbar button:hover { background: #e8f5e9; }
  @media print {
    .no-print { display: none; }
    body { margin: 0; }
    .entry, .notes p { break-inside: avoid; page-break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="toolbar no-print"><button onclick="window.print()">Print</button></div>
<h1>${esc(title)}</h1>
${sections}
${notesHtml}
</body>
</html>`;
}

// Printable one-line-per-hike schedule sheet (calendar counterpart of the
// descriptions sheet): date | hike line, grouped by month, print CSS.
// monthGroups: [{ label, rows: [{ dateStr, trailName, difficulty, earlyLabel, leader }] }]
// notes: [{ heading, text }]
export function generatePrintableScheduleHtml({ title, monthGroups, notes = [] }) {
  const tables = monthGroups.map((group) => {
    if (!group.rows.length) {
      return `<h2 class="month">${esc(group.label)}</h2><p class="empty">No hikes scheduled.</p>`;
    }
    const rows = group.rows.map((r) => {
      const hike = esc(r.trailName)
        + (r.difficulty ? `  ${esc(r.difficulty)}` : '')
        + (r.earlyLabel ? ` <span class="early-start">(${esc(r.earlyLabel)})</span>` : '')
        + (r.leader ? ` &mdash; <span class="leader">Leader: ${esc(r.leader)}</span>` : '');
      return `<tr><td class="date">${esc(r.dateStr)}</td><td>${hike}</td></tr>`;
    }).join('');
    return `<h2 class="month">${esc(group.label)}</h2><table>${rows}</table>`;
  }).join('');

  const notesHtml = notes.length
    ? `<div class="notes">${notes.map((n) => `<p><b>${esc(n.heading)}</b> ${esc(n.text)}</p>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 18px; line-height: 1.5; margin: 40px; color: #222; }
  h1 { font-size: 24pt; font-weight: bold; font-family: Arial, sans-serif; margin-bottom: 30px; }
  h2.month { font-size: 20pt; font-weight: bold; font-family: Arial, sans-serif; margin: 26px 0 12px; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 4px 10px 4px 0; vertical-align: top; font-size: 16pt; border-bottom: 1px solid #eee; }
  td.date { white-space: nowrap; font-weight: bold; }
  .leader { font-style: italic; }
  .early-start { color: red; }
  .empty { font-size: 18pt; }
  .notes { margin-top: 32px; font-size: 13pt; line-height: 1.5; }
  .toolbar { position: sticky; top: 0; background: #fff; padding: 8px 0; margin-bottom: 12px; border-bottom: 1px solid #ddd; }
  .toolbar button { font: inherit; font-size: 14px; padding: 6px 14px; border: 1px solid #2e7d32; border-radius: 6px; background: #fff; color: #2e7d32; cursor: pointer; }
  .toolbar button:hover { background: #e8f5e9; }
  @media print {
    .no-print { display: none; }
    body { margin: 0; }
    tr, .notes p { break-inside: avoid; page-break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="toolbar no-print"><button onclick="window.print()">Print</button></div>
<h1>${esc(title)}</h1>
${tables}
${notesHtml}
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

// Generate HTML report for a single trail (same format as monthly report)
export function generateTrailHtml(trail, trailDetails, dateStr) {
  let headerHtml = '';
  const date = dateStr ? (dateStr instanceof Date ? dateStr : new Date(dateStr)) : new Date();
  const formattedDate = `${DAY_NAMES[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
  const title = `${formattedDate} — ${getTrailName(trail)}`;
  const trailLine = buildTrailLineHtml(trail, false);
  headerHtml = `<div class="entry-header">${esc(formattedDate)}\t${trailLine}</div>`;

  let html = `<!DOCTYPE html>
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
`;

  html += `<div class="entry">${headerHtml}`;
  html += buildTrailDetailsHtml(trail, trailDetails, 'compact');
  html += `</div>`;

  html += `</body></html>`;
  return html;
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
