import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { usePageContext } from '../contexts/PageContext';
import { useMonthContext } from '../contexts/MonthContext';
import { useDayContext } from '../contexts/DayContext';
import { ScheduleSettingsProvider } from '../contexts/ScheduleSettingsContext';
import { getGroupName } from '../utils/config';
import { getTrailName } from '../utils/data';
import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useEffect } from 'react';
import { NAV_LINKS } from '../utils/constants';
import { getDaysInMonth } from '../utils/dateUtils';
import MonthSelector from './MonthSelector';
import DaySelector from './DaySelector';
import ScheduleSettingsDropdown from './ScheduleSettingsDropdown';

const APP_VERSION = __APP_VERSION;

function PageContextSetter() {
  const { pathname } = useLocation();
  const { setPageContext } = usePageContext();
  const { trails } = useTrails();
  const { trailDetails } = useTrailStore();

  useEffect(() => {
    if (pathname.startsWith('/trail/')) {
      const match = pathname.match(/\/trail\/(.+)$/);
      if (match && trails && trails.length > 0) {
        const id = match[1];
        const trail = trails.find(t => t.id === id);
        setPageContext(trail ? getTrailName(trail) : 'Trail Detail');
      } else {
        setPageContext('Trail Detail');
      }
    } else if (pathname === '/browse') {
      setPageContext(`${trails?.length || 0} trails`);
    } else if (pathname === '/trails') {
      setPageContext(`${trails?.length || 0} trails`);
    } else if (pathname === '/') {
      setPageContext('');
    }
  }, [pathname, trails, trailDetails, setPageContext]);

  return null;
}

function HeaderContent() {
  const { pageContext } = usePageContext();
  const { selectedMonth, setSelectedMonth } = useMonthContext();
  const { selectedDay, setSelectedDay } = useDayContext();
  const { pathname } = useLocation();
  const groupName = getGroupName();
  const isSchedule = pathname === '/schedule';
  const isBrowse = pathname === '/browse';

  useEffect(() => {
    const daysInMonth = getDaysInMonth(2026, selectedMonth);
    setSelectedDay(String(Math.min(new Date().getDate(), daysInMonth)));
  }, [selectedMonth, setSelectedDay]);

  return (
    <>
      <PageContextSetter />
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <nav className="flex items-baseline gap-2 flex-shrink-0">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      isActive
                        ? 'text-lg font-bold text-gray-900'
                        : 'text-sm text-green-700 hover:text-green-900 font-medium'
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <span className="text-xs text-gray-400">v{APP_VERSION}</span>
              </nav>
              <MonthSelector
                selectedMonth={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                title="Select month"
              />
              {isBrowse && (
                <DaySelector
                  selectedDay={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  month={selectedMonth}
                  title="Select day"
                />
              )}
              <div className="flex items-center gap-3 ml-4 min-w-0">
                {isSchedule ? (
                  <ScheduleSettingsDropdown />
                ) : pageContext ? (
                  <span className="text-sm font-medium text-gray-600 truncate hidden sm:block">
                    {pageContext}
                  </span>
                ) : null}
                {groupName && (
                  <span className="text-lg font-black text-green-800 uppercase tracking-tight flex-shrink-0">
                    {groupName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-3">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default function Layout() {
  return (
    <ScheduleSettingsProvider>
      <HeaderContent />
    </ScheduleSettingsProvider>
  );
}
