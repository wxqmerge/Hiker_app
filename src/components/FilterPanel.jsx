import { useState, useCallback } from 'react';
import { MONTH_NAMES, DEFAULT_FILTERS } from '../utils/constants';
import { useTooltips } from '../hooks/useTooltips';
import { getDistanceUnit, getElevationUnit } from '../utils/units';
import DualRangeSlider from './DualRangeSlider';
import PillButton from './shared/PillButton';
import { Button, Icon } from './ui';

export default function FilterPanel({ filters, setFilters, lookup, resetFilters, totalCount, filteredCount, onRainSort }) {
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
    filters.distance.min !== DEFAULT_FILTERS.distance.min || filters.distance.max !== DEFAULT_FILTERS.distance.max ||
    filters.elevation.min !== DEFAULT_FILTERS.elevation.min || filters.elevation.max !== DEFAULT_FILTERS.elevation.max ||
    filters.difficulties.length > 0 ||
    filters.months.length > 0 ||
    filters.wilderness ||
    (filters.gpx && filters.gpx !== 'all') ||
    (filters.tide && filters.tide !== 'all');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
      <div className="px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">
          Filters{filteredCount != null ? ` · ${filteredCount} of ${totalCount} trails` : ''}
        </h3>
        <Button
          variant="icon"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          title={tt(collapsed ? 'Show filters' : 'Hide filters')}
          aria-label={collapsed ? 'Show filters' : 'Hide filters'}
        >
          <Icon className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} path="M5 15l7-7 7 7" />
        </Button>
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
          aria-label="Search trails by name"
        />

        {/* Distance */}
         <DualRangeSlider
           min={0}
           max={100}
           step={0.5}
           value={filters.distance}
           onChange={(distance) => setFilters({ ...filters, distance })}
           unit={getDistanceUnit()}
           tooltip={`Trail distance range in ${getDistanceUnit() === 'mi' ? 'miles' : 'km'}`}
           label="Dist"
         />

         {/* Elevation */}
         <div className="w-px h-10 bg-gray-300 mx-2" />
         <DualRangeSlider
           min={0}
           max={15000}
           step={100}
           value={filters.elevation}
           onChange={(elevation) => setFilters({ ...filters, elevation })}
           unit={getElevationUnit()}
           tooltip={`Trail elevation range in ${getElevationUnit() === 'ft' ? 'feet' : 'meters'}`}
           label="Elev"
         />

       {/* Difficulty */}
        <div className="flex gap-1.5">
            {difficulties.map(diff => (
              <PillButton
                key={diff.code}
                active={filters.difficulties.includes(diff.code)}
                onClick={() => toggleDifficulty(diff.code)}
                title={tt(`Toggle ${diff.label} filter`)}
                ariaLabel={`Toggle ${diff.label} filter`}
                ariaPressed={filters.difficulties.includes(diff.code)}
              >
                {diff.label}
              </PillButton>
            ))}
          </div>

         {/* Sort */}
          <div className="flex gap-1.5 ml-auto">
            <PillButton active={filters.sortBy === 'name'} onClick={() => setSortBy('name')} title={tt('Sort alphabetically')} ariaLabel="Sort alphabetically" ariaPressed={filters.sortBy === 'name'}>A-Z</PillButton>
            <PillButton active={filters.sortBy === 'popularity'} onClick={() => setSortBy('popularity')} title={tt('Sort by popularity')} ariaLabel="Sort by popularity" ariaPressed={filters.sortBy === 'popularity'}>Pop</PillButton>
            <PillButton active={filters.sortBy === 'elevation-up'} onClick={() => setSortBy('elevation-up')} title={tt('Sort by elevation (low to high)')} ariaLabel="Sort by elevation, low to high" ariaPressed={filters.sortBy === 'elevation-up'}>Elev ↑</PillButton>
            <PillButton active={filters.sortBy === 'elevation-down'} onClick={() => setSortBy('elevation-down')} title={tt('Sort by elevation (high to low)')} ariaLabel="Sort by elevation, high to low" ariaPressed={filters.sortBy === 'elevation-down'}>Elev ↓</PillButton>
            <PillButton active={filters.sortBy === 'distance-up'} onClick={() => setSortBy('distance-up')} title={tt('Sort by distance (shortest first)')} ariaLabel="Sort by distance, shortest first" ariaPressed={filters.sortBy === 'distance-up'}>Dist ↑</PillButton>
            <PillButton active={filters.sortBy === 'distance-down'} onClick={() => setSortBy('distance-down')} title={tt('Sort by distance (longest first)')} ariaLabel="Sort by distance, longest first" ariaPressed={filters.sortBy === 'distance-down'}>Dist ↓</PillButton>
            <PillButton color="blue" active={filters.sortBy === 'rain'} onClick={() => { setSortBy('rain'); onRainSort?.(); }} title={tt('Sort by forecast rain (driest first, no data last) · fetches weather')} ariaLabel="Sort by forecast rain, driest first" ariaPressed={filters.sortBy === 'rain'}>☔ Rain</PillButton>
            <PillButton active={filters.wilderness} onClick={toggleWilderness} title={tt('Filter wilderness trails')} ariaLabel="Filter wilderness trails" ariaPressed={filters.wilderness}>◆</PillButton>
            <PillButton active={filters.sortBy === 'not-wilderness'} onClick={() => setSortBy('not-wilderness')} title={tt('Sort non-wilderness trails first')} ariaLabel="Sort non-wilderness trails first" ariaPressed={filters.sortBy === 'not-wilderness'}>◆ off</PillButton>
        </div>

        {/* GPX */}
        <div className="flex gap-1.5 items-center">
          <PillButton active={filters.gpx === 'all'} onClick={() => setFilters(prev => ({ ...prev, gpx: 'all' }))} title={tt('Show all trails')} ariaLabel="Show all trails" ariaPressed={filters.gpx === 'all'}>All</PillButton>
          <PillButton active={filters.gpx === 'gpx'} onClick={() => setFilters(prev => ({ ...prev, gpx: 'gpx' }))} title={tt('Filter trails with GPX')} ariaLabel="Filter trails with GPX" ariaPressed={filters.gpx === 'gpx'}>GPX</PillButton>
          <PillButton active={filters.gpx === 'noGpx'} onClick={() => setFilters(prev => ({ ...prev, gpx: 'noGpx' }))} title={tt('Filter trails without GPX')} ariaLabel="Filter trails without GPX" ariaPressed={filters.gpx === 'noGpx'}>No GPX</PillButton>
        </div>

        {/* Tide */}
        <div className="flex gap-1.5 items-center">
          <PillButton color="blue" active={filters.tide === 'all'} onClick={() => setFilters(prev => ({ ...prev, tide: 'all' }))} title={tt('Show all trails')} ariaLabel="Show all trails" ariaPressed={filters.tide === 'all'}>All</PillButton>
          <PillButton color="blue" active={filters.tide === 'tide'} onClick={() => setFilters(prev => ({ ...prev, tide: 'tide' }))} title={tt('Filter trails with tide data')} ariaLabel="Filter trails with tide data" ariaPressed={filters.tide === 'tide'}>Tide</PillButton>
          <PillButton color="blue" active={filters.tide === 'noTide'} onClick={() => setFilters(prev => ({ ...prev, tide: 'noTide' }))} title={tt('Filter trails without tide data')} ariaLabel="Filter trails without tide data" ariaPressed={filters.tide === 'noTide'}>No Tide</PillButton>
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
                aria-label={`Toggle ${month} filter`}
                aria-pressed={filters.months.includes(idx)}
              >
                {month.substring(0, 3)}
              </button>
            ))}
          </div>

        {/* Reset */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            title={tt('Reset all filters')}
            aria-label="Reset all filters"
          >
            ✕
          </Button>
        )}
          </div>
        </div>
      )}
    </div>
  );
}
