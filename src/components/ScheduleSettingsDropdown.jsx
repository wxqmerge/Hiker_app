import { useState } from 'react';
import { useScheduleSettings } from '../contexts/ScheduleSettingsContext';
import { useTrailActions } from '../contexts/TrailActionsContext';
import DropdownItem from './shared/DropdownItem';

const TABS = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'user', label: 'User' },
  { id: 'admin', label: 'Admin' },
];

export default function ScheduleSettingsDropdown() {
  const {
    showSettings, setShowSettings,
    fetchingWeather, nextHikeDate, fetchWeatherForAll,
    handleExport, exportExcelSchedule,
    importFromExcel, hasApiKey, importScheduleTsv,
    openHistory, verifyServerSchedule,
    debugMode, setDebugMode,
    handleReload, clearSchedule,
  } = useScheduleSettings();
  const trailActions = useTrailActions();
  const [activeTab, setActiveTab] = useState('schedule');

  if (!fetchWeatherForAll) return null;

  const close = () => setShowSettings(false);
  const section = (title) => (
    <div className="px-3 py-2 border-t border-b border-gray-100 mt-1 first:mt-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
    </div>
  );

  const scheduleTab = (
    <div className="max-h-[70vh] overflow-y-auto">
      <button
        onClick={fetchWeatherForAll}
        disabled={fetchingWeather || !nextHikeDate}
        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
          fetchingWeather || !nextHikeDate
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004-4h1a4 4 0 003.77-5.53A6 6 0 0018 11h1a4 4 0 004-4" />
        </svg>
        {fetchingWeather ? 'Fetching Weather…' : !nextHikeDate ? 'No Upcoming Hike Date' : 'Fetch Weather for All'}
      </button>
      <button onClick={handleExport} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
        </svg>
        Export Monthly HTML
      </button>
      <button onClick={exportExcelSchedule} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export Quarterly Schedule
      </button>
      <button onClick={importFromExcel} disabled={!hasApiKey} className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${hasApiKey ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Import SOTHH Schedule.xls {!hasApiKey && '(need API key)'}
      </button>
      <button onClick={importScheduleTsv} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Import Quarterly Schedule TSV
      </button>
      <button onClick={openHistory} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Schedule History
      </button>
      <button onClick={verifyServerSchedule} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Verify Pushed to Server
      </button>
      <button
        onClick={() => setDebugMode(!debugMode)}
        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
          debugMode ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100' : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Debug Mode {debugMode ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={handleReload}
        disabled={!hasApiKey}
        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
          hasApiKey ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m0 0a8.003 8.003 0 0113.385-4.368l-.707.707" />
        </svg>
        Reload Server Data {!hasApiKey && '(need API key)'}
      </button>
      <button
        onClick={clearSchedule}
        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear All Data
      </button>
    </div>
  );

  const userTab = trailActions ? (
    <div className="max-h-[70vh] overflow-y-auto py-1">
      {section('Trail')}
      <DropdownItem onClick={() => { close(); trailActions.userActions.newTrail(); }}>New Trail</DropdownItem>
      {section('Export')}
      <DropdownItem onClick={() => { close(); trailActions.userActions.exportJson(); }}>Export JSON</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.userActions.exportZip(); }}>Export ZIP</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.userActions.exportGpxZip(); }}>Export GPX ZIP</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.userActions.exportSchedule(); }}>Export Schedule</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.userActions.exportMonthlyPop(); }}>Export Monthly Pop</DropdownItem>
      {section('Maintenance')}
      <DropdownItem onClick={() => { close(); trailActions.userActions.validateDb(); }} disabled={trailActions.validating}>Validate DB</DropdownItem>
    </div>
  ) : (
    <p className="px-3 py-2 text-sm text-gray-400">Trail actions unavailable</p>
  );

  const adminTab = trailActions ? (
    <div className="max-h-[70vh] overflow-y-auto py-1">
      <div className="px-3 py-2 border-b border-gray-100">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1" htmlFor="global-admin-api-key">API Key</label>
        <div className="flex gap-1">
          <input
            id="global-admin-api-key"
            type="password"
            value={trailActions.apiKey}
            onChange={(e) => trailActions.setApiKey(e.target.value)}
            placeholder="API Key"
            aria-label="Admin API key"
            className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-green-500 focus:border-green-500"
          />
          <button
            onClick={trailActions.saveApiKey}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs whitespace-nowrap"
          >
            Save
          </button>
        </div>
      </div>
      {section('Import Trails')}
      <DropdownItem onClick={() => { close(); trailActions.adminActions.importDatabase(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Import Database (XLS)</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.adminActions.importHikeTsv(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Import Hike TSV</DropdownItem>
      {section('Import All')}
      <DropdownItem onClick={() => { close(); trailActions.adminActions.importAllJson(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Import All JSON</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.adminActions.importZip(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Import ZIP</DropdownItem>
      {section('Schedule')}
      <DropdownItem onClick={() => { close(); trailActions.adminActions.importScheduleJson(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Import Schedule JSON</DropdownItem>
      {section('Popularity Data')}
      <DropdownItem onClick={() => { close(); trailActions.adminActions.importMonthlyTsv(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Import Monthly Pop TSV</DropdownItem>
      {section('Maintenance')}
      <DropdownItem onClick={() => { close(); trailActions.adminActions.cleanupOrphanedDetails(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Cleanup Orphaned Details</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.adminActions.validateData(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Validate Data</DropdownItem>
      <DropdownItem onClick={() => { close(); trailActions.adminActions.resyncCoords(); }} disabled={!trailActions.hasApiKey} locked={!trailActions.hasApiKey}>Re-sync GPX Coords</DropdownItem>
    </div>
  ) : (
    <p className="px-3 py-2 text-sm text-gray-400">Admin actions unavailable</p>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        title="Schedule settings"
        aria-label="Schedule settings"
        aria-expanded={showSettings}
        aria-controls="schedule-settings-menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>
      {showSettings && (
        <div id="schedule-settings-menu" className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-64 z-50">
          <div className="flex border-b border-gray-100 mb-1" role="tablist" aria-label="Schedule settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-green-700 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'schedule' && scheduleTab}
          {activeTab === 'user' && userTab}
          {activeTab === 'admin' && adminTab}
        </div>
      )}
    </div>
  );
}
