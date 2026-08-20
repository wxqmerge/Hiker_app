/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { CURRENT_YEAR } from '../utils/constants';

const YearContext = createContext({ selectedYear: CURRENT_YEAR, setSelectedYear: () => {} });

export function YearContextProvider({ children }) {
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  return (
    <YearContext.Provider value={{ selectedYear, setSelectedYear }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYearContext() {
  return useContext(YearContext);
}
