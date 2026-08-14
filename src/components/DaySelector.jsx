import { getDaysInMonth } from '../utils/dateUtils';

export default function DaySelector({ selectedDay, onChange, month, title }) {
  const year = 2026;
  const daysInMonth = getDaysInMonth(year, month);

  return (
    <select
      value={selectedDay}
      onChange={onChange}
      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
      title={title}
    >
      <option value="">Day</option>
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
        <option key={day} value={day}>{day}</option>
      ))}
    </select>
  );
}
