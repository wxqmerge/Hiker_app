import { useState } from 'react';
import { Modal, Button } from './ui';
import { getDayName, slotLetter } from '../utils/config';
import { createDate } from '../utils/dateUtils';
import { getTrailName } from '../utils/data';

function MoveHikeForm({ source, hikeDates, assignedHikes, findTrailById, year, selectedMonth, onMove, onClose }) {
  const [target, setTarget] = useState('');

  const sourceTrail = findTrailById(source.trailId);
  const sourceName = sourceTrail ? getTrailName(sourceTrail) : source.trailId;
  const options = hikeDates.filter(({ day, slot }) => !(day === source.sourceDay && slot === source.sourceSlot));

  const slotLabel = (day, slot) => {
    const hasMultipleSlots = hikeDates.filter((s) => s.day === day).length > 1;
    return hasMultipleSlots ? ` ${slotLetter(slot)}` : '';
  };

  const sourceDayLabel = source.sourceDay === null || source.sourceDay === undefined
    ? 'Available Hikes'
    : `${getDayName(createDate(year, selectedMonth, source.sourceDay).getDay())} ${source.sourceDay}${slotLabel(source.sourceDay, source.sourceSlot)}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!target) return;
    const [day, slot] = target.split(':').map(Number);
    onMove(source, day, slot);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Move ${sourceName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-700">
          Currently on <strong>{sourceDayLabel}</strong>.
        </p>
        <label className="block text-sm text-gray-700">
          <span className="font-medium">Move to</span>
          <select
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="" disabled>Choose a date</option>
            {options.map(({ day, slot }) => {
              const date = createDate(year, selectedMonth, day);
              const entry = assignedHikes[day]?.[slot];
              const targetTrail = entry?.trail_id ? findTrailById(entry.trail_id) : null;
              const label = `${getDayName(date.getDay())} ${day}${slotLabel(day, slot)} — ${targetTrail ? getTrailName(targetTrail) : 'open'}`;
              return (
                <option key={`${day}:${slot}`} value={`${day}:${slot}`}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!target}>Move</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MoveHikeModal({ open, source, ...props }) {
  if (!open || !source) return null;
  return <MoveHikeForm key={`${source.sourceDay ?? 'available'}:${source.sourceSlot ?? 0}`} source={source} {...props} />;
}
