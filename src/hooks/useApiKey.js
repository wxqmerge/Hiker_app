import { useMemo } from 'react';
import { hasStoredApiKey } from '../utils/apiKey';

export function useApiKey() {
  return useMemo(() => hasStoredApiKey(), []);
}
