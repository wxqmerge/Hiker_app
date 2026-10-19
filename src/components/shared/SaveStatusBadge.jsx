/**
 * Save-status pill shown in the header/schedule toolbars.
 * Centralizes the previously duplicated badge markup
 * (Layout.jsx and ScheduleBuilder.jsx).
 */
export default function SaveStatusBadge({ saveStatus }) {
  if (!saveStatus || saveStatus === 'idle') return null;
  const color =
    saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700'
      : saveStatus === 'saved' ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700';
  const label =
    saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save failed';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
