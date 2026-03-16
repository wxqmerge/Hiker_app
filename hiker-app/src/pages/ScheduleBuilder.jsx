import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrails } from '../hooks/useTrails';
import Header from '../components/Header';

export default function ScheduleBuilder() {
  const { trails, loading } = useTrails();
  const [selectedTrailIds, setSelectedTrailIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleTrail = (id) => {
    setSelectedTrailIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const selectedTrails = trails.filter(t => selectedTrailIds.includes(t.id));
  
  const filteredForSelection = trails.filter(t => {
    if (!searchTerm) return true;
    return t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           t.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const copyToClipboard = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    let output = 'HIKE SCHEDULE\n';
    output += '='.repeat(50) + '\n\n';
    output += `Generated: ${new Date().toLocaleDateString()}\n`;
    output += `Total Hikes: ${selectedTrails.length}\n\n`;
    
    selectedTrails.forEach((trail, idx) => {
      output += `${idx + 1}. ${trail.name}\n`;
      output += `   Distance: ${trail.distance?.toFixed(1) || 'N/A'} mi`;
      if (trail.distanceExtended) output += ` / ${trail.distanceExtended.toFixed(1)} mi`;
      output += `\n`;
      output += `   Elevation: ${trail.elevationStart?.toLocaleString() || 'N/A'}' - ${trail.elevationMax?.toLocaleString() || 'N/A'}'\n`;
      output += `   Difficulty: ${trail.difficulty}\n`;
      if (trail.notes) {
        output += `   Notes: ${trail.notes}\n`;
      }
      output += '\n';
    });

    navigator.clipboard.writeText(output);
    alert('Schedule copied to clipboard!');
  };

  const clearSelection = () => {
    setSelectedTrailIds([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-3">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Schedule Builder</h2>
          <p className="text-gray-600">
            Select trails to build your schedule. Copy to clipboard for use in Word.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selection Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Trails</h3>
            
            <input
              type="text"
              placeholder="Search trails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />

            <div className="max-h-96 overflow-y-auto">
              {filteredForSelection.map(trail => (
                <div 
                  key={trail.id}
                  onClick={() => toggleTrail(trail.id)}
                  className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                    selectedTrailIds.includes(trail.id)
                      ? 'bg-green-100 border-green-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  } border`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">{trail.name}</span>
                    {selectedTrailIds.includes(trail.id) && (
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {trail.distance?.toFixed(1)} mi • {trail.elevationStart?.toLocaleString()}' • {trail.difficulty}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Selected ({selectedTrails.length})</h3>
              {selectedTrailIds.length > 0 && (
                <button
                  onClick={clearSelection}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear all
                </button>
              )}
            </div>

            {selectedTrails.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No trails selected</p>
            ) : (
              <div>
                <ul className="divide-y divide-gray-200 mb-4">
                  {selectedTrails.map(trail => (
                    <li key={trail.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-800">{trail.name}</span>
                        <p className="text-sm text-gray-500">
                          {trail.distance?.toFixed(1)} mi • {trail.difficulty}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleTrail(trail.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Total distance: {selectedTrails.reduce((sum, t) => sum + (t.distance || 0), 0).toFixed(1)} miles
                  </p>
                  
                  <button
                    onClick={copyToClipboard}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Copy Schedule to Clipboard
                  </button>
                  
                  <Link 
                    to="/"
                    className="block text-center text-green-600 hover:text-green-800 text-sm mt-3"
                  >
                    Back to Browse
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
