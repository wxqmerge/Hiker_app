import { useMemo } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { getMonthRange } from '../utils/dateUtils';
import { useMonthSlotStats } from '../hooks/useMonthSlotStats';
import { useTrails } from '../hooks/useTrails';
import { useScheduleStore } from '../hooks/useScheduleStore';
import Selector from './Selector';

export default function MonthSelector({ selectedMonthKey, onChange, title }) {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const scheduleStore = useScheduleStore(scheduleData);
  const months = useMemo(() => getMonthRange(), []);
  const years = useMemo(() => Array.from(new Set(months.map(({ year }) => year))), [months]);
  const monthSlotStats = useMonthSlotStats({ trails, scheduleStore, years });

  return (
    <Selector value={selectedMonthKey} onChange={onChange} title={title}>
      {months.map(({ year, month, key }) => {
        const stat = monthSlotStats?.[key];
        const baseLabel = `${MONTH_NAMES[month]} ${year}`;
        const label = stat && !loading
          ? `${baseLabel} ${stat.filled}/${stat.total}`
          : baseLabel;
        return (
          <option key={key} value={key}>{label}</option>
        );
      })}
    </Selector>
  );
}
