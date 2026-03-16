import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function TrailNavigation({ trails, currentTrailId, onSelectTrail, showBackLink = false, onCopyReport }) {
  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpSearch, setJumpSearch] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Find the index of the current trail
  useEffect(() => {
    if (currentTrailId) {
      const idx = trails.findIndex(t => t.id === currentTrailId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [currentTrailId, trails]);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevTrail = trails[currentIndex - 1];
      if (prevTrail) {
        onSelectTrail(prevTrail.id);
      }
    }
  };

  const goToNext = () => {
    if (currentIndex < trails.length - 1) {
      const nextTrail = trails[currentIndex + 1];
      if (nextTrail) {
        onSelectTrail(nextTrail.id);
      }
    }
  };

  const goToTrail = (index) => {
    if (index >= 0 && index < trails.length) {
      const targetTrail = trails[index];
      if (targetTrail) {
        onSelectTrail(targetTrail.id);
      }
      setShowJumpModal(false);
      setJumpSearch('');
    }
  };

  const handleCopyReport = async () => {
    if (onCopyReport) {
      await onCopyReport();
    }
  };

  const filteredTrailsForJump = jumpSearch
    ? trails.filter(t => 
        t.name?.toLowerCase().includes(jumpSearch.toLowerCase()) ||
        t.fullName?.toLowerCase().includes(jumpSearch.toLowerCase())
      ).slice(0, 20)
    : [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Previous Button */}
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            currentIndex === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        {/* Current Position */}
        <div className="text-center">
          <span className="text-sm text-gray-600">
            Trail {currentIndex + 1} of {trails.length}
          </span>
          {trails[currentIndex] && (
            <p className="text-sm font-medium text-gray-800">{trails[currentIndex].fullName || trails[currentIndex].name}</p>
          )}
        </div>

        {/* Next and Jump Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowJumpModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            Jump To
          </button>
          
          <button
            onClick={goToNext}
            disabled={currentIndex === trails.length - 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              currentIndex === trails.length - 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            Next
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Secondary actions row */}
      {(showBackLink || onCopyReport) && (
        <div className="flex items-center gap-4 pt-3 border-t border-gray-200 mt-3">
          {showBackLink && (
            <Link to="/" className="text-green-700 hover:text-green-900 font-medium flex items-center gap-1">
              ← Back to browse
            </Link>
          )}
           {onCopyReport && (
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-900"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Report
            </button>
          )}
        </div>
      )}

      {/* Jump Modal */}
      {showJumpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Jump to Trail</h3>
            
            <input
              type="text"
              placeholder="Search trail name..."
              value={jumpSearch}
              onChange={(e) => setJumpSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />

            <div className="max-h-64 overflow-y-auto mb-4">
              {filteredTrailsForJump.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {filteredTrailsForJump.map((trail, idx) => {
                    const actualIndex = trails.findIndex(t => t.id === trail.id);
                    return (
                      <li
                        key={trail.id}
                        onClick={() => goToTrail(actualIndex)}
                        className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      >
                        <span className="text-sm font-medium text-gray-800">{trail.fullName || trail.name}</span>
                        <span className="text-xs text-gray-500">#{actualIndex + 1}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : jumpSearch ? (
                <p className="text-sm text-gray-500 text-center py-4">No trails found</p>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Start typing to search...</p>
              )}
            </div>

            <button
              onClick={() => {
                setShowJumpModal(false);
                setJumpSearch('');
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
