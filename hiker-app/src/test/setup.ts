import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock window.location for file:// protocol checks
Object.defineProperty(window, 'location', {
  value: { protocol: 'file:' },
  writable: true,
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
  },
  writable: true,
});

// Mock URL.createObjectURL and URL.revokeObjectURL
URL.createObjectURL = vi.fn(() => 'blob:http://test.com/mock');
URL.revokeObjectURL = vi.fn();

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn(function () {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
  }),
});

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: vi.fn(function () {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  }),
});

// Embed mock data for useTrails/useTrailDetails
// useTrails expects: window.__EMBEDDED_DATA__.trails = { trails: [...] }
window.__EMBEDDED_DATA__ = {
  trails: {
    trails: [
      {
        id: 'trail-1',
        name: 'Rainier',
        fullName: 'Mount Rainier',
        distance: 5.5,
        distanceExtended: 6.0,
        elevationStart: 2000,
        elevationMax: 4000,
        difficulty: 'Moderate',
        parking: 'Lot',
        range: 45,
        notes: 'Beautiful trail',
        seasonal: { Jan: 3, Feb: 2, Mar: 1, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 },
      },
      {
        id: 'trail-2',
        name: 'Stevens',
        fullName: 'Stevens Ridge',
        distance: 12.3,
        elevationStart: 3500,
        difficulty: 'Difficult',
        parking: 'Discover',
        seasonal: { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 1, Oct: 2, Nov: 3, Dec: 0 },
      },
      {
        id: 'trail-3',
        name: 'Easy Path',
        fullName: 'Easy Path Trail',
        distance: 2.1,
        elevationStart: 800,
        difficulty: 'Easy',
        parking: 'Free',
        seasonal: {},
      },
    ],
  },
  lookup: {
    difficulties: [
      { code: 'Easy', label: 'Easy' },
      { code: 'Moderate', label: 'Moderate' },
      { code: 'Difficult', label: 'Difficult' },
    ],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
  },
  trail_details: {
    'trail-1': {
      fullDescription: 'This is a beautiful trail with great views.',
      pros: 'Great views',
      others: 'Parking is easy',
      leaders: ['Alice', 'Bob'],
    },
  },
  schedule: {
    Jun: [
      { day: 1, hike: 'Rainier Hike', trail_id: 'trail-1' },
      { day: 3, hike: 'Stevens Hike', trail_id: 'trail-2' },
      { day: 5, hike: 'Easy Path Hike', trail_id: 'trail-3' },
    ],
    Jul: [
      { day: 1, hike: 'Rainier Hike', trail_id: 'trail-1' },
    ],
  },
};
