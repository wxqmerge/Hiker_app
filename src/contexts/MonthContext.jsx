/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getMonthKey, parseMonthKey } from '../utils/dateUtils';

function getInitialMonthKey() {
  const now = new Date();
  return getMonthKey(now.getFullYear(), now.getMonth());
}

const initialMonthKey = getInitialMonthKey();
const initialMonth = parseMonthKey(initialMonthKey);

const MonthContext = createContext({
  selectedMonthKey: initialMonthKey,
  selectedMonth: initialMonth.month,
  selectedYear: initialMonth.year,
  setSelectedMonthKey: () => {},
  setSelectedMonth: () => {},
});

export function MonthContextProvider({ children }) {
  const [selectedMonthKey, setSelectedMonthKey] = useState(getInitialMonthKey);
  const { year: selectedYear, month: selectedMonth } = parseMonthKey(selectedMonthKey);

  const setSelectedMonth = useCallback((month) => {
    setSelectedMonthKey(getMonthKey(selectedYear, month));
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
