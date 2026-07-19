import { useState, useCallback } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { useTooltips } from '../hooks/useTooltips';
import DualRangeSlider from './DualRangeSlider';

export default function FilterPanel({ filters, setFilters, lookup, resetFilters }) {
  const { title: tt } = useTooltips();
  const [collapsed, setCollapsed] = useState(false);
  const difficulties = lookup?.difficulties || [];
  const months = lookup?.months || MONTH_NAMES;

  const toggleDifficulty = useCallback((difficulty) => {
    setFilters(prev => ({
      ...prev,
      difficulties: prev.difficulties.includes(difficulty)
        ? prev.difficulties.filter(d => d !== difficulty)
        : [...prev.difficulties, difficulty]
    }));
  }, [setFilters]);

  const toggleMonth = useCallback((monthIndex) => {
    setFilters(prev => ({
      ...prev,
      months: prev.months.includes(monthIndex)
        ? prev.months.filter(m => m !== monthIndex)
        : [...prev.months, monthIndex]
    }));
  }, [setFilters]);

  const setSortBy = useCallback((sortBy) => {
    setFilters(prev => ({ ...prev, sortBy }));
  }, [setFilters]);

  const toggleWilderness = useCallback(() => {
    setFilters(prev => ({ ...prev, wilderness: !prev.wilderness }));
  }, [setFilters]);

  const hasActiveFilters =
    filters.search ||
    filters.distance.min > 0 || filters.distance.max < 20 ||
    filters.elevation.min > 0 || filters.elevation.max < 5000 ||
    filters.difficulties.length > 0 ||
    filters.months.length > 0 ||
    filters.wilderness ||
    (filters.gpx && filters.gpx !== 'all');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
      <div className="px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">Filters</h3>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={tt(collapsed ? 'Show filters' : 'Hide filters')}
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="p-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-52 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-green-500 focus:border-green-500"
          title={tt('Filter trails by name')}
        />

       {/* Distance */}
        <DualRangeSlider
          min={0}
          max={20}
          step={0.5}
          value={filters.distance}
          onChange={(distance) => setFilters({ ...filters, distance })}
          unit="mi"
          tooltip="Trail distance range in miles"
          label="Dist"
        />

        {/* Elevation */}
        <div className="w-px h-10 bg-gray-300 mx-2" />
        <DualRangeSlider
          min={0}
          max={5000}
          step={100}
          value={filters.elevation}
          onChange={(elevation) => setFilters({ ...filters, elevation })}
          unit="ft"
          tooltip="Trail elevation range in feet"
          label="Elev"
        />

       {/* Difficulty */}
        <div className="flex gap-1.5">
            {difficulties.map(diff => (
              <button
                key={diff.code}
                onClick={() => toggleDifficulty(diff.code)}
                className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
                  filters.difficulties.includes(diff.code)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={tt(`Toggle ${diff.label} filter`)}
              >
                {diff.label}
              </button>
            ))}
          </div>

         {/* Sort */}
         <div className="flex gap-1.5 ml-auto">
          <button
            onClick={() => setSortBy('name')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'name'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Sort alphabetically')}
          >
            A-Z
          </button>
          <button
            onClick={() => setSortBy('popularity')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'popularity'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Sort by popularity')}
          >
            Pop
          </button>
          <button
            onClick={() => setSortBy('elevation-up')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'elevation-up'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Sort by elevation (low to high)')}
          >
            Elev ↑
          </button>
          <button
            onClick={() => setSortBy('elevation-down')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'elevation-down'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Sort by elevation (high to low)')}
          >
            Elev ↓
          </button>
          <button
            onClick={() => setSortBy('distance-up')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'distance-up'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Sort by distance (shortest first)')}
          >
            Dist ↑
          </button>
          <button
            onClick={() => setSortBy('distance-down')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'distance-down'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Sort by distance (longest first)')}
          >
            Dist ↓
          </button>
          <button
            onClick={toggleWilderness}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.wilderness
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Filter wilderness trails')}
          >
            ◆
          </button>
          <button
            onClick={() => setSortBy('not-wilderness')}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'not-wilderness'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Sort non-wilderness trails first')}
          >
            ◆ off
          </button>
        </div>

        {/* GPX */}
        <div className="flex gap-1.5 items-center">
          <button
            onClick={() => setFilters(prev => ({ ...prev, gpx: 'all' }))}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.gpx === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Show all trails')}
          >
            All
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, gpx: 'gpx' }))}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.gpx === 'gpx'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Filter trails with GPX')}
          >
            GPX
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, gpx: 'noGpx' }))}
            className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.gpx === 'noGpx'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={tt('Filter trails without GPX')}
          >
            No GPX
          </button>
        </div>

        {/* Months */}
        <div className="flex gap-1">
            {months.map((month, idx) => (
              <button
                key={idx}
                onClick={() => toggleMonth(idx)}
                className={`w-8 py-1 rounded text-sm font-medium transition-colors ${
                  filters.months.includes(idx)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={tt(`Toggle ${month} filter`)}
              >
                {month.substring(0, 3)}
              </button>
            ))}
          </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-sm text-green-600 hover:text-green-800 font-medium px-2.5 py-1"
            title={tt('Reset all filters')}
          >
            ✕
          </button>
        )}
          </div>
        </div>
      )}
    </div>
  );
}
