import { useMemo } from 'react';
import { serverScheduleToStore } from '../utils/scheduleFormat';

export function useScheduleStore(schedule) {
  return useMemo(() => serverScheduleToStore(schedule), [schedule]);
}
