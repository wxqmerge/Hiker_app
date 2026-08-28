import { useEffect, useMemo, useState } from 'react';
import { getHikeDays, getMaxHikesPerDay, subscribeConfigChange, getConfigVersion } from '../utils/config';

function useConfigVersion() {
  const [version, setVersion] = useState(getConfigVersion);

  useEffect(() => {
    return subscribeConfigChange(() => setVersion(getConfigVersion()));
  }, []);

  return version;
}

export function useHikeDays() {
  const version = useConfigVersion();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getHikeDays(), [version]);
}

/**
 * Subscribe to the configured maximum hikes per day (slot cap, default 3).
 * @returns {number}
 */
export function useMaxHikesPerDay() {
  const version = useConfigVersion();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getMaxHikesPerDay(), [version]);
}
