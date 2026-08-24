import { useEffect } from 'react';

const APP_VERSION = __APP_VERSION;
const VISITED_KEY = 'hiker-has-visited';

export function hasVisited() {
  return localStorage.getItem(VISITED_KEY) === '1';
}

export function markVisited() {
  localStorage.setItem(VISITED_KEY, '1');
}

export default function SplashScreen({ onDismiss }) {
  useEffect(() => {
    const dismiss = () => {
      markVisited();
      onDismiss();
    };
    window.addEventListener('click', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-gradient-to-br from-green-700 to-emerald-800 flex items-center justify-center p-6 cursor-pointer"
      role="presentation"
      onClick={() => { markVisited(); onDismiss(); }}
    >
      <div className="max-w-md w-full bg-white/95 rounded-2xl shadow-2xl p-6 md:p-8">
        <p className="text-2xl font-bold text-gray-800 mb-1">
          Hiker Trail App
        </p>
        <p className="text-sm text-gray-400 mb-4">v{APP_VERSION}</p>
        <p className="text-base text-gray-600 mb-5">
          Open source hike planning and scheduling tool.
        </p>
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Legend</p>
          <dl className="text-base text-gray-700 space-y-2">
            <div><dt className="inline font-mono font-semibold">ETC</dt><dd className="inline"> — estimated return time to Sequim ± 90 min</dd></div>
            <div><dt className="inline font-mono font-semibold">TH</dt><dd className="inline"> — trailhead (Google Maps directions)</dd></div>
            <div><dt className="inline font-mono font-semibold">GPX</dt><dd className="inline"> — GPS track (download / share)</dd></div>
            <div><dt className="inline font-mono font-semibold">Get Maps</dt><dd className="inline"> — navigation app for offline GPX</dd></div>
            <div><dt className="inline font-mono font-semibold">◆</dt><dd className="inline"> — wilderness trail (limit 12 hikers)</dd></div>
            <div><dt className="inline font-mono font-semibold">Tide</dt><dd className="inline"> — NOAA low tide prediction</dd></div>
            <div><dt className="inline font-mono font-semibold">Early Start</dt><dd className="inline"> — departs 30 min earlier</dd></div>
            <div><dt className="inline font-mono font-semibold">°F</dt><dd className="inline"> — high temp at trailhead</dd></div>
            <div><dt className="inline font-mono font-semibold">%</dt><dd className="inline"> — chance of rain</dd></div>
          </dl>
        </div>
        <div className="flex items-center justify-between">
          <a
            href="https://github.com/wxqmerge/Hiker_app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-green-700 hover:text-green-900 hover:underline flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.567v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.744.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.14c0 .309.192.684.803.566c4.769-1.589 8.199-6.086 8.199-11.386c0-6.627-5.373-12-12-12z" />
            </svg>
            Open Source
          </a>
          <span className="text-sm text-gray-400">Tap anywhere to continue</span>
        </div>
      </div>
    </div>
  );
}
