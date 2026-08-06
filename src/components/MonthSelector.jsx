import { MONTH_NAMES } from '../utils/constants';

export default function MonthSelector({ selectedMonth, onChange, title }) {
  return (
    <select
      value={selectedMonth}
      onChange={onChange}
      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
      title={title}
    >
      {MONTH_NAMES.map((name, idx) => (
        <option key={idx} value={idx}>{name}</option>
      ))}
    </select>
  );
}
