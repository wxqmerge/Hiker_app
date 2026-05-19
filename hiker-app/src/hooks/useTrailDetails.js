import { useState, useEffect } from 'react';

// Shared trail details loading logic
// Checks window.__EMBEDDED_DATA__ first, then fetches from file:// protocol
export function useTrailDetails() {
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (window.__EMBEDDED_DATA__?.trail_details) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetails(window.__EMBEDDED_DATA__.trail_details);
    } else if (window.location.protocol !== 'file:') {
      fetch('/data/trail_details.json')
        .then(res => res.json())
        .then(data => setDetails(data))
        .catch(err => console.error('Error loading trail details:', err));
    }
  }, []);

  return details;
}
