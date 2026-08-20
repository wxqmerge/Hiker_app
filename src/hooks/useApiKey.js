import { useState, useEffect } from 'react';
import { hasStoredApiKey, subscribeApiKeyChange, API_KEY_STORAGE_KEY } from '../utils/apiKey';

export function useApiKey() {
  const [hasKey, setHasKey] = useState(() => hasStoredApiKey());

  useEffect(() => {
    const update = () => setHasKey(hasStoredApiKey());
    const unsubscribe = subscribeApiKeyChange(update);
    const onStorage = (e) => {
      if (e.key === API_KEY_STORAGE_KEY || e.key === null) {
        update();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return hasKey;
}
