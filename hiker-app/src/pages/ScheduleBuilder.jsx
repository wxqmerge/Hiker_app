import { useState, useMemo, useEffect } from 'react';
import { getRideCost } from '../utils/report';
import { useTrails } from '../hooks/useTrails';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ScheduleBuilder() {
  const { trails, loading: trailsLoading } = useTrails();
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const nextMonth = (now.getMonth() + 1) % 12;
    return nextMonth;
  });
  const [selectedHikes, setSelectedHikes] = useState([]);

  useEffect(() => {
    if (window.__EMBEDDED_DATA__?.schedule) {
      setScheduleData(window.__EMBEDDED_DATA__.schedule);
    }
  }, []);

  const monthHikes = useMemo(() => {
    if (!scheduleData) return [];
    const monthAbbr = MONTH_ABBR[selectedMonth];
    return scheduleData[monthAbbr] || [];
  }, [scheduleData, selectedMonth]);

  const year = 2026;

  const toggleHike = (hike) => {
    setSelectedHikes(prev => {
      const exists = prev.find(h => h.hike === hike.hike && h.day === hike.day);
      if (exists) {
        return prev.filter(h => !(h.hike === hike.hike && h.day === hike.day));
      }
      return [...prev, hike];
    });
  };

  const getCalendarDays = () => {
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(year, selectedMonth, 1).getDay();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, selectedMonth, day);
      const dayOfWeek = date.getDay();
      const isWed = dayOfWeek === 3;
      const isFri = dayOfWeek === 5;
      const hikes = monthHikes.filter(h => h.day === day);
      const selectedCount = hikes.filter(h => selectedHikes.some(sh => sh.hike === h.hike && sh.day === h.day)).length;

      days.push({
        day,
        isWed,
        isFri,
        hikes,
        selectedCount,
        totalHikes: hikes.length
      });
    }

    return days;
  };

  const exportToFile = () => {
    if (selectedHikes.length === 0) {
      alert('No hikes selected.');
      return;
    }

    const month = MONTH_NAMES[selectedMonth];
    let output = `Over-the-Hill Hike Descriptions -- ${month}, ${year}\n`;

    for (const hike of selectedHikes) {
      const trail = trails.find(t => {
        const name = (t.fullName || t.name).toLowerCase();
        return name.includes(hike.hike.toLowerCase().substring(0, 8)) ||
               hike.hike.toLowerCase().includes(name.substring(0, 8));
      });

      const dayName = hike.day % 10 === 1 && hike.day !== 11 ? 'st' :
                      hike.day % 10 === 2 && hike.day !== 12 ? 'nd' :
                      hike.day % 10 === 3 && hike.day !== 13 ? 'rd' : 'th';

      if (trail) {
        let name = trail.fullName || trail.name;
        name = name.replace(/◆\uFE0E?$/, '').replace(/◆+$/, '');

        const difficulty = `[${trail.difficulty}]`;
        let distanceText = trail.distance != null ? trail.distance.toFixed(1) : 'N/A';
        if (trail.distanceExtended) distanceText += `-${trail.distanceExtended.toFixed(1)}`;
        const elevStart = trail.elevationStart != null ? trail.elevationStart.toLocaleString() : '0';
        const elevMax = trail.elevationMax != null ? trail.elevationMax.toLocaleString() : elevStart;
        const elevationText = `${elevStart}'-${elevMax}'`;
        const parking = trail.parking || '';
        const rideCost = trail.range ? getRideCost(parseInt(trail.range)) : '';

        output += `Wed, ${month} ${hike.day}\t${name}◆︎  ${difficulty}\t${distanceText} / ${elevationText}\t${parking}`;
        if (rideCost) output += `\t${rideCost}`;
        output += '\n';

        if (trail.seasonal?.bestSeason) {
          output += `Season: ${trail.seasonal.bestSeason}\n`;
        }
        if (trail.notes && trail.notes !== trail.fullName) {
          output += `${trail.notes}\n`;
        }
      } else {
        output += `Wed, ${month} ${hike.day}\t${hike.hike}\t(No match)\n`;
      }
      output += '\n';
    }

    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${month.toLowerCase()}_${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (trailsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!scheduleData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Schedule data not loaded. Run `python match_schedule.py` first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Schedule Builder</h2>
          <p className="text-gray-600 text-sm mt-1">
            Build your monthly hike schedule. Select hikes from the calendar and export to text.
          </p>
        </div>

        {/* Month Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="block w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
          >
            {MONTH_NAMES.map((name, idx) => {
              const monthAbbr = name.substring(0, 3);
              const count = scheduleData[monthAbbr] ? scheduleData[monthAbbr].length : 0;
              return (
                <option key={idx} value={idx}>
                  {name} {year} ({count} hikes)
                </option>
              );
            })}
          </select>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">
              Select Hikes for {MONTH_NAMES[selectedMonth]} {year}
            </h3>
            <p className="text-sm text-gray-600">
              Click on hikes to add/remove them from your schedule
            </p>
          </div>

          <div className="p-4">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {getCalendarDays().map((day, idx) => {
                if (!day) {
                  return <div key={idx} className="h-24"></div>;
                }

                const hasHikes = day.hikes.length > 0;
                const isSelected = day.selectedCount > 0;
                const isWed = day.isWed;
                const isFri = day.isFri;

                return (
                  <div
                    key={idx}
                    className={`h-24 border-2 rounded-lg p-2 transition-all ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : isWed || isFri
                        ? 'border-green-300 hover:border-green-400 hover:bg-green-50'
                        : 'border-gray-200 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-lg font-bold ${
                        isWed || isFri ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {day.day}
                      </span>
                      {hasHikes && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'
                        }`}>
                          {day.selectedCount}/{day.totalHikes}
                        </span>
                      )}
                    </div>

                    {hasHikes && (
                      <div className="space-y-1">
                        {day.hikes.map((hike, hikeIdx) => {
                          const isSelected = selectedHikes.some(sh => sh.hike === hike.hike && sh.day === hike.day);
                          return (
                            <button
                              key={hikeIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHike(hike);
                              }}
                              className={`w-full text-left text-xs px-1 py-0.5 rounded truncate ${
                                isSelected
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                              }`}
                            >
                              {hike.hike}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Hikes List */}
        {selectedHikes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                Selected Hikes ({selectedHikes.length})
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {selectedHikes.map((hike, idx) => {
                  const trail = trails.find(t => {
                    const name = (t.fullName || t.name).toLowerCase();
                    return name.includes(hike.hike.toLowerCase().substring(0, 8)) ||
                           hike.hike.toLowerCase().includes(name.substring(0, 8));
                  });

                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{hike.hike}</span>
                        {trail && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({trail.fullName || trail.name})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600">
                          Wed, {MONTH_NAMES[selectedMonth]} {hike.day}
                        </span>
                        <button
                          onClick={() => toggleHike(hike)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Export */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedHikes.length} hike{selectedHikes.length !== 1 ? 's' : ''} selected
          </div>
          <button
            onClick={exportToFile}
            disabled={selectedHikes.length === 0}
            className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              selectedHikes.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
            </svg>
            Export to Text File
          </button>
        </div>
      </main>
    </div>
  );
}
