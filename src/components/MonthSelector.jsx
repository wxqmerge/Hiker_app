import { MONTH_NAMES } from '../utils/constants';

export default function MonthSelector({ selectedMonth, onChange, monthSlotStats, assignedCount, hikeDates, title }) {
  return (
    <>
      <select
        value={selectedMonth}
        onChange={onChange}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
        title={title}
      >
        {MONTH_NAMES.map((name, idx) => {
          const { total, filled } = monthSlotStats[idx] || { total: 0, filled: 0 };
          const label = total > 0 ? `${filled}/${total}` : '0/0';
          const color = filled === 0 ? '#9ca3af' : filled === total ? '#15803d' : '#a16207';
          return (
            <option key={idx} value={idx} style={{ color }}>
              {name} ({label})
            </option>
          );
        })}
      </select>
      <p className="text-gray-600 text-sm ml-auto">
        {monthSlotStats[selectedMonth]?.filled ?? assignedCount}/{monthSlotStats[selectedMonth]?.total ?? hikeDates.length} slots filled
      </p>
    </>
  );
}
