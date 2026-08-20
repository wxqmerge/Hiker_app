import { useMemo } from 'react';
import { MONTH_NAMES, CURRENT_YEAR } from '../utils/constants';
import { useMonthSlotStats } from '../hooks/useMonthSlotStats';
import { useTrails } from '../hooks/useTrails';
import { serverScheduleToStore } from '../utils/scheduleFormat';
import Selector from './Selector';

export default function MonthSelector({ selectedMonth, onChange, title, year = CURRENT_YEAR }) {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const scheduleStore = useMemo(() => serverScheduleToStore(scheduleData), [scheduleData]);
  const monthSlotStats = useMonthSlotStats({ trails, scheduleStore, year });

  return (
    <Selector value={selectedMonth} onChange={onChange} title={title}>
      {MONTH_NAMES.map((name, idx) => {
        const stat = monthSlotStats?.[idx];
        const label = stat && !loading
          ? `${name} ${stat.filled}/${stat.total}`
          : name;
        return (
          <option key={idx} value={idx}>{label}</option>
        );
      })}
    </Selector>
  );
}
