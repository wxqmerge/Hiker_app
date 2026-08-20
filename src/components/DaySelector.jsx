import { getDaysInMonth } from '../utils/dateUtils';
import { CURRENT_YEAR } from '../utils/constants';
import Selector from './Selector';

export default function DaySelector({ selectedDay, onChange, month, title, year = CURRENT_YEAR }) {
  const daysInMonth = getDaysInMonth(year, month);

  return (
    <Selector value={selectedDay} onChange={onChange} title={title}>
      <option value="">Day</option>
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
        <option key={day} value={day}>{day}</option>
      ))}
    </Selector>
  );
}
