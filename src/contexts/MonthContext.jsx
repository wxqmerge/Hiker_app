/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getMonthKey, parseMonthKey } from '../utils/dateUtils';

const STORAGE_KEY = 'hiker-month-state';

function loadMonthFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate month is 0-11 and year is reasonable
      if (parsed.month >= 0 && parsed.month <= 11 && parsed.year > 2000) {
        return parsed;
      }
    }
  /* eslint-disable no-unused-vars */
  } catch (e) {
    // ignored
  /* eslint-enable no-unused-vars */
  }
  /* eslint-disable no-unused-vars */
  return null;
}

function saveMonthToStorage(month, year) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ month, year }));
  } catch (e) {
    // ignored
  }
}

function getInitialMonthKey() {
  const now = new Date();
  return getMonthKey(now.getFullYear(), now.getMonth());
}

const stored = loadMonthFromStorage();
const initialMonthKey = stored ? getMonthKey(stored.year, stored.month) : getInitialMonthKey();
const initialMonth = stored ? { month: stored.month, year: stored.year } : parseMonthKey(initialMonthKey);

const MonthContext = createContext({
  selectedMonthKey: initialMonthKey,
  selectedMonth: initialMonth.month,
  selectedYear: initialMonth.year,
  setSelectedMonthKey: () => {},
  setSelectedMonth: () => {},
});

export function MonthContextProvider({ children }) {
  const [selectedMonthKey, setSelectedMonthKey] = useState(initialMonthKey);
  const { year: selectedYear, month: selectedMonth } = parseMonthKey(selectedMonthKey);

  const setSelectedMonth = useCallback((month) => {
    setSelectedMonthKey(getMonthKey(selectedYear, month));
    saveMonthToStorage(month, selectedYear);
  }, [selectedYear]);

  const value = useMemo(() => ({
    selectedMonthKey,
    selectedMonth,
    selectedYear,
    setSelectedMonthKey,
    setSelectedMonth,
  }), [selectedMonthKey, selectedMonth, selectedYear, setSelectedMonth]);

  return (
    <MonthContext.Provider value={value}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonthContext() {
  return useContext(MonthContext);
}
