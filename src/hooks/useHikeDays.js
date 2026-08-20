import { useEffect, useMemo, useState } from 'react';
import { getHikeDays, subscribeConfigChange, getConfigVersion } from '../utils/config';

export function useHikeDays() {
  const [version, setVersion] = useState(getConfigVersion);

  useEffect(() => {
    return subscribeConfigChange(() => setVersion(getConfigVersion()));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getHikeDays(), [version]);
}
