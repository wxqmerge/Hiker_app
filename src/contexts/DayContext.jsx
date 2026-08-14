/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const DayContext = createContext({ selectedDay: '', setSelectedDay: () => {} });

export function DayContextProvider({ children }) {
  const [selectedDay, setSelectedDay] = useState(() => String(new Date().getDate()));
  return (
    <DayContext.Provider value={{ selectedDay, setSelectedDay }}>
      {children}
    </DayContext.Provider>
  );
}

export function useDayContext() {
  return useContext(DayContext);
}
