import { useMemo } from 'react';

export function useApiKey() {
  return useMemo(() => !!localStorage.getItem('hiker-api-key'), []);
}
