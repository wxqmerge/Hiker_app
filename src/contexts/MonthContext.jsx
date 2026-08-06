/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const MonthContext = createContext({ selectedMonth: 0, setSelectedMonth: () => {} });

export function MonthContextProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  return (
    <MonthContext.Provider value={{ selectedMonth, setSelectedMonth }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonthContext() {
  return useContext(MonthContext);
}
