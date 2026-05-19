export default function FilterPanel({ filters, setFilters, lookup, resetFilters }) {
  const difficulties = lookup?.difficulties || [];
  const months = lookup?.months || ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

  const getSortLabel = (label, active) => {
    const current = filters.sortBy;
    if (active && (current === label || current.startsWith(label + '-'))) {
      return label + (current.endsWith('-up') ? ' ↑' : ' ↓');
    }
    return label;
  };

  const hasActiveFilters = 
    filters.search ||
    filters.distanceMin > 0 || filters.distanceMax < 20 ||
    filters.elevationMin > 0 || filters.elevationMax < 5000 ||
    filters.difficulties.length > 0 ||
    filters.months.length > 0 ||
    filters.wilderness;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      {/* Search, Distance & Elevation on one line */}
      <div className="flex gap-4 items-center mb-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search trails by name..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Distance Range */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Max Distance: {filters.distanceMax} mi
          </label>
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={filters.distanceMax}
            onChange={(e) => setFilters({ ...filters, distanceMax: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Elevation Range */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Max Elevation: {filters.elevationMax} ft
          </label>
          <input
            type="range"
            min="0"
            max="5000"
            step="100"
            value={filters.elevationMax}
            onChange={(e) => setFilters({ ...filters, elevationMax: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Difficulty Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
        <div className="flex flex-wrap gap-2">
          {difficulties.map(diff => (
            <button
              key={diff.code}
              onClick={() => toggleDifficulty(diff.code)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.difficulties.includes(diff.code)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {diff.label}
            </button>
          ))}
        </div>
      </div>

      {/* Month Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Available Months</label>
        <div className="flex flex-wrap gap-2">
          {months.map((month, idx) => (
            <button
              key={idx}
              onClick={() => toggleMonth(idx)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                filters.months.includes(idx)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {month.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Sort Buttons */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'name'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Name
          </button>
          <button
            onClick={() => setSortBy('popularity')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'popularity'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Popularity
          </button>
          <button
            onClick={() => setSortBy('elevation-up')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'elevation-up'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Elevation ↑
          </button>
          <button
            onClick={() => setSortBy('elevation-down')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'elevation-down'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Elevation ↓
          </button>
          <button
            onClick={() => setSortBy('distance-up')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'distance-up'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Distance ↑
          </button>
          <button
            onClick={() => setSortBy('distance-down')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'distance-down'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Distance ↓
          </button>
          <button
            onClick={toggleWilderness}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.wilderness
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Wilderness
          </button>
          <button
            onClick={() => setSortBy('not-wilderness')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filters.sortBy === 'not-wilderness'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Not Wilderness
          </button>
        </div>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="text-sm text-green-600 hover:text-green-800 font-medium"
        >
          Reset all filters
        </button>
      )}
    </div>
  );
}
