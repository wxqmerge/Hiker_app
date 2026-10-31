// Abbreviation legend shown on the splash screen (compact) and in the
// settings dropdown (full wording). Single source so the two cannot drift.
const ITEMS = [
  { term: 'ETC', def: ' — estimated return time to Sequim \u00b1 90 min' },
  { term: 'TH', def: ' — trailhead (Google Maps directions)' },
  { term: 'GPX', def: ' — GPS track (download / share)' },
  {
    term: 'Get Maps',
    def: ' — navigation app for offline GPX',
    longDef: ' — links to a navigation app (Organic Maps / GPXSee) that opens GPX files offline',
  },
  {
    term: '\u25C6',
    def: ' — wilderness trail (limit 12 hikers)',
    longDef: ' — wilderness trail (limit 12 hikers in group)',
  },
  { term: 'Tide', def: ' — NOAA low tide prediction' },
  { term: 'Early Start', def: ' — departs 30 min earlier' },
  { term: '\u00b0F', def: ' — high temp at trailhead' },
  { term: '%', def: ' — chance of rain' },
];

export default function LegendList({ compact = false }) {
  return (
    <dl className="text-base text-gray-700 space-y-2">
      {ITEMS.map(({ term, def, longDef }) => (
        <div key={term}>
          <dt className="inline font-mono font-semibold">{term}</dt>
          <dd className="inline">{longDef && !compact ? longDef : def}</dd>
        </div>
      ))}
    </dl>
  );
}
