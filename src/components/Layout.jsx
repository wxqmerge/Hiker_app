import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { usePageContext } from '../contexts/PageContext';
import { useMonthContext } from '../contexts/MonthContext';
import { useDayContext } from '../contexts/DayContext';
import { ScheduleSettingsProvider, useScheduleSettings } from '../contexts/ScheduleSettingsContext';
import { TrailActionsProvider, useTrailActions } from '../contexts/TrailActionsContext';
import { getGroupName, getGroupUrl } from '../utils/config';
import { getTrailName } from '../utils/data';
import { useTrails } from '../hooks/useTrails';
import { useEffect, useMemo } from 'react';
import { NAV_LINKS } from '../utils/constants';
import { getDaysInMonth } from '../utils/dateUtils';
import MonthSelector from './MonthSelector';
import DaySelector from './DaySelector';
import ScheduleSettingsDropdown from './ScheduleSettingsDropdown';
import SaveStatusBadge from './shared/SaveStatusBadge';

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

function GroupBadge({ name }) {
  const url = getGroupUrl();
  const label = name;
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-lg font-black text-green-800 uppercase tracking-tight flex-shrink-0 hover:underline"
        title={`Open ${label} schedule descriptions`}
      >
        {label}
      </a>
    );
  }
  return (
    <span className="text-lg font-black text-green-800 uppercase tracking-tight flex-shrink-0">
      {label}
    </span>
  );
}

function HeaderContent() {
  const { pageContext } = usePageContext();
  const { selectedMonth, selectedYear, selectedMonthKey, setSelectedMonthKey } = useMonthContext();
  const { selectedDay, setSelectedDay } = useDayContext();
  const { pathname } = useLocation();
  const { trails } = useTrails();
  const {
    newTrailForm, setNewTrailForm,
    newTrailName, setNewTrailName,
    submitNewTrail,
  } = useTrailActions();
  const { saveStatus } = useScheduleSettings();
  const groupName = getGroupName();
  const isSchedule = pathname === '/schedule';
  const isMainPage = pathname === '/' || pathname === '/browse' || pathname === '/schedule';

  useEffect(() => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const day = parseInt(selectedDay, 10);
    if (isNaN(day) || day < 1 || day > daysInMonth) {
      setSelectedDay(String(Math.min(new Date().getDate(), daysInMonth)));
    }
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
          <div className="container mx-auto px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <nav aria-label="Primary" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      isActive
                        ? 'text-base font-bold text-gray-900 sm:text-lg'
                        : 'text-base font-medium text-green-700 hover:text-green-900 sm:text-lg'
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <MonthSelector
                  selectedMonthKey={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  title="Select month"
                />
                <DaySelector
                  selectedDay={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  month={selectedMonth}
                  year={selectedYear}
                  title="Select day"
                />
                <span className="text-sm font-medium text-gray-400">v{APP_VERSION}</span>
              </nav>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 lg:gap-4">
                <SaveStatusBadge saveStatus={saveStatus} />
                <ScheduleSettingsDropdown />
                {!isSchedule && pageContext && (
                  <span className="min-w-0 max-w-full break-words text-base font-medium text-gray-600">
                    {pageContext}
                  </span>
                )}
                {groupName && (
                  <GroupBadge name={groupName} />
                )}
                {isMainPage && (
                  <span className="max-w-full break-words text-sm leading-snug text-gray-500 sm:text-base">
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
