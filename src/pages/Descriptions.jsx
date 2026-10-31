import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTrails } from '../hooks/useTrails';
import { useScheduleStore } from '../hooks/useScheduleStore';
import { useGpxActions } from '../hooks/useGpxActions';
import LoadingSpinner from '../components/LoadingSpinner';
import { MONTH_NAMES, DAY_NAMES } from '../utils/constants';
import { getGroupName } from '../utils/config';
import { getTodayHikeRef, createDate, getMonthKey } from '../utils/dateUtils';
import { getDayEntries } from '../utils/scheduleFormat';
import { normalizeStartOffset } from '../utils/etc';
import { findTrailById, getTrailName } from '../utils/data';
import { buildTrailLineParts } from '../utils/formatTrail';
import { generateDescriptionsPrintHtml, generatePrintableScheduleHtml } from '../utils/report';
import { openHtmlInNewTab } from '../utils/io';
import { safeWebLink } from '../utils/url';

// The two months to show: current and next, regardless of the calendar's
// selected month. Hikes before today are never listed.
function upcomingMonths(today) {
  return [0, 1].map((offset) => {
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return { year: first.getFullYear(), month: first.getMonth() };
  });
}

function collectMonthHikes(scheduleStore, trails, year, month, today) {
  const monthData = scheduleStore[getMonthKey(year, month)] || {};
  const hikes = [];
  for (const dayStr of Object.keys(monthData)) {
    const day = parseInt(dayStr, 10);
    if (!Number.isFinite(day)) continue;
    const date = createDate(year, month, day);
    if (date < today) continue; // no past hikes
    for (const entry of getDayEntries(monthData, day)) {
      if (!entry?.trail_id) continue;
      const trail = findTrailById(trails, entry.trail_id);
      if (!trail) continue;
      hikes.push({
        day,
        date,
        trail,
        trailId: entry.trail_id,
        leader: entry.leader || '',
        earlyStart: normalizeStartOffset(entry.early_start),
      });
    }
  }
  return hikes;
}

function earlyStartLabel(offset) {
  if (offset === 0) return null;
  return offset < 0 ? `${Math.abs(offset)}m early` : `${offset}m late`;
}

// Full month names in date lines, matching the old hike-descriptions page.
function fullDateStr(d) {
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function footerNotes(clubName) {
  return [
    { heading: 'NOTE:', text: 'As with any hike, do your own research on a particular hike and assess whether it is of your hiking ability. Always carry your Hiking Essentials and do not rely on others to bring them for you. Thank you!' },
    { heading: 'DISCLAIMER:', text: `${clubName} assumes no collective or individual liability for any mishaps on any of their hikes or outings. Please use discretion and be safe. Please read the Hazards & Liability section on the Home page of the website and refer to the link given and agree to the conditions set forth in that document.` },
    { heading: 'WILDERNESS HIKE:', text: 'Any hike with a \u25C6\uFE0E goes into the Wilderness, so there is a Wilderness Regulation of a limit of 12 in a group. Please honor this and divide up.' },
    { heading: 'EARLY START:', text: 'Watch for an e-mail from the leader(s) ahead of time indicating what time to meet at the Sequim Public parking lot.' },
  ];
}

function HikeEntry({ hike }) {
  const { trail, trailId, date, earlyStart } = hike;
  const { trailDetails } = useTrails();
  const { handleGpxDownload, gpxDownloading } = useGpxActions(trail);
  const { name, distanceText, elevationText, parking, rideCost } = buildTrailLineParts(trail);
  // Same wilderness predicate as the filter/report: the ◆ lives in the name.
  const isWilderness = getTrailName(trail).includes('\u25C6');
  const desc = trailDetails[trailId]?.fullDescription?.trim();
  const webLink = safeWebLink(trail.webLink);
  const early = earlyStartLabel(earlyStart);

  return (
    <div className="mb-7">
      <div className="font-bold text-base md:text-lg leading-snug">
        <span>{DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}</span>
        <span className="ml-3">
          <Link to={`/trail/${trailId}`} className="text-gray-900 hover:underline">
            {name}
            {isWilderness && <span title="Wilderness trail (limit 12 hikers)">&#9670;&#xFE0E;</span>}
          </Link>
          {'  '}[{trail.difficulty}]
          {'  '}{distanceText} / {elevationText}
          {parking && <>  {parking}</>}
          {rideCost && <>  {rideCost}</>}
        </span>
        {early && <span className="ml-2 text-red-600 font-normal">({early})</span>}
      </div>

      {desc && <p className="mt-2 text-base leading-relaxed text-gray-800 whitespace-pre-line">{desc}</p>}

      {webLink && (
        <p className="mt-2">
          <a href={webLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all">
            {webLink}
          </a>
        </p>
      )}

      {trail.hasGpx && (
        <p className="mt-2">
          GPX:{' '}
          <button
            onClick={handleGpxDownload}
            disabled={gpxDownloading}
            className="text-blue-700 underline disabled:opacity-50"
          >
            {gpxDownloading ? 'downloading\u2026' : 'available'}
          </button>
        </p>
      )}
    </div>
  );
}

export default function Descriptions() {
  const { trails, schedule, trailDetails, loading } = useTrails();
  const scheduleStore = useScheduleStore(schedule);

  const months = useMemo(() => {
    const today = getTodayHikeRef();
    return upcomingMonths(today).map((m) => ({
      ...m,
      label: `${MONTH_NAMES[m.month]}, ${m.year}`,
      hikes: collectMonthHikes(scheduleStore, trails, m.year, m.month, today),
    }));
  }, [scheduleStore, trails]);

  if (loading) {
    return <LoadingSpinner message="Loading upcoming hikes..." />;
  }

  const totalHikes = months.reduce((sum, m) => sum + m.hikes.length, 0);
  const clubName = getGroupName() || 'Over-the-Hill';

  const handlePrint = () => {
    const monthGroups = months.map((m) => ({
      label: m.label,
      entries: m.hikes.map((h) => ({
        dateStr: fullDateStr(h.date),
        trail: h.trail,
        trailDetails,
        earlyStart: h.earlyStart,
      })),
    }));
    openHtmlInNewTab(generateDescriptionsPrintHtml({
      title: `${clubName} Hike Descriptions`,
      monthGroups,
      notes: footerNotes(clubName),
    }));
  };

  const handlePrintSchedule = () => {
    const monthGroups = months.map((m) => ({
      label: m.label,
      rows: m.hikes.map((h) => ({
        dateStr: fullDateStr(h.date),
        trailName: (() => {
          const { name } = buildTrailLineParts(h.trail);
          return getTrailName(h.trail).includes('\u25C6') ? `${name}\u25C6\uFE0E` : name;
        })(),
        difficulty: `[${h.trail.difficulty}]`,
        earlyLabel: earlyStartLabel(h.earlyStart) || '',
        leader: h.leader,
      })),
    }));
    // Only the two legends that matter for a bare schedule listing.
    const notes = footerNotes(clubName).slice(2);
    openHtmlInNewTab(generatePrintableScheduleHtml({
      title: `${clubName} Hiking Schedule`,
      monthGroups,
      notes,
    }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 text-gray-900">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">{clubName} Hike Descriptions</h1>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={handlePrintSchedule}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
          >
            Printable schedule
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
          >
            Printable version
          </button>
        </div>
      </div>

      <div className="mt-6">
        {totalHikes === 0 && (
          <p className="text-gray-600 mb-6">
            No hikes scheduled for {months[0].label} or {months[1].label}.
          </p>
        )}
        {months.map((m) => (
          <section key={`${m.year}-${m.month}`} className="mb-8">
            <h2 className="text-xl font-bold mb-4">{m.label}</h2>
            {m.hikes.length === 0 ? (
              <p className="text-gray-500">No hikes scheduled.</p>
            ) : (
              m.hikes.map((hike, i) => <HikeEntry key={`${m.year}-${m.month}-${i}`} hike={hike} />)
            )}
          </section>
        ))}
      </div>

      {/* Footer notes copied from the old hike-descriptions page */}
      <div className="mt-8 space-y-3 text-sm text-gray-800 leading-relaxed">
        {footerNotes(clubName).map((n) => (
          <p key={n.heading}>
            <span className="font-bold">{n.heading}</span> {n.text}
          </p>
        ))}
      </div>
    </div>
  );
}
