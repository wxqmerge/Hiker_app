import { getDaysInMonth } from '../utils/dateUtils';
import { CURRENT_YEAR } from '../utils/constants';

export default function DaySelector({ selectedDay, onChange, month, title }) {
  const year = CURRENT_YEAR;
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
