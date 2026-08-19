import { useState, useEffect, useRef } from 'react';

/**
 * Small inline form for editing a hike leader name, replacing the native
 * `prompt()` dialog. Submits on Enter, cancels on Escape.
 */
export default function LeaderEdit({ initialLeader, onSave, onCancel, tt = (s) => s }) {
  const [value, setValue] = useState(initialLeader || '');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-1 mt-1"
      onClick={(e) => e.stopPropagation()}
      title={tt('Edit hike leader')}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        placeholder="Leader name"
        aria-label="Leader name"
        className="flex-1 min-w-0 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:ring-blue-500 focus:border-blue-500"
      />
      <button type="submit" className="text-xs font-medium text-green-700 hover:text-green-900" title={tt('Save leader')}>
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700" title={tt('Cancel')}>
        Cancel
      </button>
    </form>
  );
}
