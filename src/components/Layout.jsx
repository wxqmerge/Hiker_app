import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { usePageContext } from '../contexts/PageContext';
import { useMonthContext } from '../contexts/MonthContext';
import { useDayContext } from '../contexts/DayContext';
import { useYearContext } from '../contexts/YearContext';
import { ScheduleSettingsProvider } from '../contexts/ScheduleSettingsContext';
import { TrailActionsProvider, useTrailActions } from '../contexts/TrailActionsContext';
import { getGroupName } from '../utils/config';
import { getTrailName } from '../utils/data';
import { useTrails } from '../hooks/useTrails';
import { useEffect, useMemo } from 'react';
import { NAV_LINKS } from '../utils/constants';
import { getDaysInMonth } from '../utils/dateUtils';
import MonthSelector from './MonthSelector';
import DaySelector from './DaySelector';
import YearSelector from './YearSelector';
import ScheduleSettingsDropdown from './ScheduleSettingsDropdown';

const APP_VERSION = __APP_VERSION;

function PageContextSetter() {
  const { pathname } = useLocation();
  const { setPageContext } = usePageContext();
  const { trails } = useTrails();

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
      setPageContext('');
    } else if (pathname === '/') {
      setPageContext('');
    }
  }, [pathname, trails, setPageContext]);

  return null;
}

function HeaderContent() {
  const { pageContext } = usePageContext();
  const { selectedMonth, setSelectedMonth } = useMonthContext();
  const { selectedDay, setSelectedDay } = useDayContext();
  const { selectedYear, setSelectedYear } = useYearContext();
  const { pathname } = useLocation();
  const { trails } = useTrails();
  const {
    newTrailForm, setNewTrailForm,
    newTrailName, setNewTrailName,
    submitNewTrail,
  } = useTrailActions();
  const groupName = getGroupName();
  const isSchedule = pathname === '/schedule';
  const isMainPage = pathname === '/' || pathname === '/browse' || pathname === '/schedule';

  useEffect(() => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    setSelectedDay(String(Math.min(new Date().getDate(), daysInMonth)));
  }, [selectedMonth, selectedDay, selectedYear, setSelectedDay]);

  const trailSummary = useMemo(() => {
    const total = trails?.length || 0;
    const gpx = trails?.filter(t => t.hasGpx).length || 0;
    const links = trails?.filter(t => t.webLink).length || 0;
    const tides = trails?.filter(t => t.tideStationId).length || 0;
    return `${total} of ${total} trails · ${gpx} GPX · ${links} links · ${tides} tides`;
  }, [trails]);

  return (
    <>
      <PageContextSetter />
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <nav aria-label="Primary" className="flex items-baseline gap-2 flex-shrink-0">
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
                <YearSelector
                  selectedYear={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  title="Select year"
                />
                <MonthSelector
                  selectedMonth={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  title="Select month"
                  year={selectedYear}
                />
                <DaySelector
                  selectedDay={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  month={selectedMonth}
                  year={selectedYear}
                  title="Select day"
                />
                <span className="text-xs text-gray-400">v{APP_VERSION}</span>
              </nav>
              <div className="flex items-center gap-3 ml-4 min-w-0">
                <ScheduleSettingsDropdown />
                {!isSchedule && pageContext && (
                  <span className="text-sm font-medium text-gray-600 truncate hidden sm:block">
                    {pageContext}
                  </span>
                )}
                {groupName && (
                  <span className="text-lg font-black text-green-800 uppercase tracking-tight flex-shrink-0">
                    {groupName}
                  </span>
                )}
                 {isMainPage && (
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {trailSummary}
                  </span>
                )}
              </div>
            </div>
          </div>
          </header>
          {newTrailForm && (
            <div className="container mx-auto px-4 py-2">
              <form
                className="flex items-center gap-2"
                aria-label="Create new trail"
                onSubmit={(e) => { e.preventDefault(); submitNewTrail(); }}
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Trail name"
                  value={newTrailName}
                  onChange={(e) => setNewTrailName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setNewTrailForm(false); }}
                  aria-label="New trail name"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-green-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                />
                <button type="submit" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm">
                  Create
                </button>
                <button type="button" onClick={() => setNewTrailForm(false)} className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm">
                  Cancel
                </button>
              </form>
            </div>
          )}
          <main id="main-content" className="container mx-auto px-4 py-3">
            <Outlet />
          </main>
      </div>
    </>
  );
}

export default function Layout() {
  return (
    <TrailActionsProvider>
      <ScheduleSettingsProvider>
        <HeaderContent />
      </ScheduleSettingsProvider>
    </TrailActionsProvider>
  );
}
