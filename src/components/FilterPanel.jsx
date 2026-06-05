import { MONTH_NAMES } from '../utils/constants';

export default function FilterPanel({ filters, setFilters, lookup, resetFilters }) {
  const difficulties = lookup?.difficulties || [];
  const months = lookup?.months || MONTH_NAMES;

  const toggleDifficulty = (difficulty) => {
    setFilters(prev => ({
      ...prev,
      difficulties: prev.difficulties.includes(difficulty)
        ? prev.difficulties.filter(d => d !== difficulty)
        : [...prev.difficulties, difficulty]
    }));
  };

  const toggleMonth = (monthIndex) => {
    setFilters(prev => ({
      ...prev,
      months: prev.months.includes(monthIndex)
        ? prev.months.filter(m => m !== monthIndex)
        : [...prev.months, monthIndex]
    }));
  };

  const setSortBy = (sortBy) => {
    setFilters(prev => ({ ...prev, sortBy }));
  };

  const toggleWilderness = () => {
    setFilters(prev => ({ ...prev, wilderness: !prev.wilderness }));
  };

  const hasActiveFilters =
    filters.search ||
    filters.distanceMin > 0 || filters.distanceMax < 20 ||
    filters.elevationMin > 0 || filters.elevationMax < 5000 ||
    filters.difficulties.length > 0 ||
    filters.months.length > 0 ||
    filters.wilderness;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3.5 mb-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-52 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-green-500 focus:border-green-500"
        />

        {/* Distance */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">Dist</span>
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={filters.distanceMax}
            onChange={(e) => setFilters({ ...filters, distanceMax: parseFloat(e.target.value) })}
            className="w-24 h-2 bg-gray-200 rounded appearance-none cursor-pointer"
          />
          <span className="w-10">{filters.distanceMax}mi</span>
        </label>

        {/* Elevation */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">Elev</span>
          <input
            type="range"
            min="0"
            max="5000"
            step="100"
            value={filters.elevationMax}
            onChange={(e) => setFilters({ ...filters, elevationMax: parseInt(e.target.value, 10) })}
            className="w-24 h-2 bg-gray-200 rounded appearance-none cursor-pointer"
          />
          <span className="w-14">{filters.elevationMax}</span>
        </label>

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
            >
              {diff.label}
            </button>
          ))}
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
            >
              {month.substring(0, 3)}
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
          >
            ◆ off
          </button>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-sm text-green-600 hover:text-green-800 font-medium px-2.5 py-1"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
