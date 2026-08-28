import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { beforeEach } from 'vitest';
import { resetFiltersStore } from '../hooks/useFilters';
import { resetTrailStore } from '../hooks/useTrailStore';
import { setGroupConfig } from '../utils/config';

// Mock data
const mockData = {
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
  trailDetails: {
    'trail-1': {
      fullDescription: 'This is a beautiful trail with great views.',
      pros: 'Great views',
      others: 'Parking is easy',
      leaders: ['Alice', 'Bob'],
    },
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

// Mock fetch for API calls
const createFetchMock = () => {
  return vi.fn((url, options) => {
    if (typeof url === 'string') {
      if (url === '/api/trails') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ trails: mockData.trails }),
        });
      }
      if (url === '/api/trails/details') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData.trailDetails),
        });
      }
      if (url === '/api/lookup') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData.lookup),
        });
      }
      if (url === '/api/schedule') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData.schedule),
        });
      }
      if (url.startsWith('/api/trails/') && url.endsWith('/details')) {
        const id = url.replace('/api/trails/', '').replace('/details', '');
        const detail = mockData.trailDetails[id];
        if (detail) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(detail),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: { message: 'Trail detail not found' } }),
        });
      }
      if (url.startsWith('/api/trails/')) {
        const id = url.replace('/api/trails/', '');
        const trail = mockData.trails.find(t => t.id === id);
        if (trail) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(trail),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: { message: 'Trail not found' } }),
        });
      }
      // PUT/DELETE requests
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { message: 'Not found' } }),
    });
  });
};

globalThis.fetch = createFetchMock();

// Reset fetch mock between tests
beforeEach(() => {
  globalThis.fetch = createFetchMock();
});

// Reset shared filter store between tests
beforeEach(() => {
  resetFiltersStore();
});

// Reset shared trail store between tests
beforeEach(() => {
  resetTrailStore();
});

// Reset shared config between tests
beforeEach(() => {
  setGroupConfig({ name: 'Test Group', hikeDays: '3,5', maxHikesPerDay: 3 });
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    origin: 'http://localhost',
    hostname: 'localhost',
    pathname: '/',
    href: 'http://localhost/',
  },
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

// Expose mock data for tests that need to modify it
globalThis.__TEST_MOCK_DATA__ = mockData;

// Configure default hike days (Wed=3, Fri=5) for tests
setGroupConfig({ name: 'Test Group', hikeDays: '3,5' });
