/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';

const ScheduleSettingsContext = createContext({
  showSettings: false,
  setShowSettings: () => {},
  register: () => {},
});

export function ScheduleSettingsProvider({ children }) {
  const [showSettings, setShowSettings] = useState(false);
  const [actions, setActions] = useState(null);

  const register = useCallback((newActions) => {
    setActions(newActions);
  }, []);

  return (
    <ScheduleSettingsContext.Provider value={{ showSettings, setShowSettings, register, ...actions }}>
      {children}
    </ScheduleSettingsContext.Provider>
  );
}

export function useScheduleSettings() {
  return useContext(ScheduleSettingsContext);
}
