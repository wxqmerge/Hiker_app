import { MONTH_NAMES } from '../utils/constants';
import { useMonthSlotStats } from '../hooks/useMonthSlotStats';
import { useTrails } from '../hooks/useTrails';
import { serverScheduleToStore } from '../utils/scheduleFormat';

export default function MonthSelector({ selectedMonth, onChange, title }) {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const year = 2026;
  const scheduleStore = serverScheduleToStore(scheduleData);
  const monthSlotStats = useMonthSlotStats({ trails, scheduleStore, year });

  return (
    <select
      value={selectedMonth}
      onChange={onChange}
      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
      title={title}
    >
      {MONTH_NAMES.map((name, idx) => {
        const stat = monthSlotStats?.[idx];
        const label = stat && !loading
          ? `${name} ${stat.filled}/${stat.total}`
          : name;
        return (
          <option key={idx} value={idx}>{label}</option>
        );
      })}
    </select>
  );
}
