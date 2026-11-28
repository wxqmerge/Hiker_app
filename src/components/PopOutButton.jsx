import { isEmbedded } from '../utils/embed';

/**
 * When the app is embedded in the club's Google Sites page (iframe),
 * show a link that opens it full-size in its own tab. A real anchor
 * with target="_blank" survives Sites' sandboxed embed far better than
 * window.open(). Renders nothing when running top-level.
 */
export default function PopOutButton() {
  if (!isEmbedded()) return null;
  return (
    <a
      href={window.location.href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the app full-size in a new tab"
      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-green-300 px-2 py-0.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 hover:text-green-900"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <path d="M15 3h6v6" />
        <path d="M10 14L21 3" />
      </svg>
      Full site
    </a>
  );
}
