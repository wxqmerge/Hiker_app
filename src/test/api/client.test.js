import { describe, it, expect, vi, beforeEach } from 'vitest';

function mockFetch(responses) {
  return vi.fn().mockImplementation(async (url, options) => {
    const handler = responses.find(([pattern, method]) => {
      const matchesUrl = typeof pattern === 'string'
        ? url === pattern || url.startsWith(pattern)
        : pattern.test(url);
      const matchesMethod = !method || options?.method === method;
      return matchesUrl && matchesMethod;
    });
    if (handler) {
      return Promise.resolve(handler[1]);
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: { message: 'Not found' } }) });
  });
}

describe('api/client', () => {
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  describe('getTrails', () => {
    it('fetches trails from /api/trails', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ trails: [{ id: 't1', name: 'Test' }] }) });
      const { getTrails } = await import('../../api/client.js');
      const result = await getTrails();
      expect(result).toEqual([{ id: 't1', name: 'Test' }]);
      expect(fetchSpy).toHaveBeenCalledWith('/api/trails', expect.any(Object));
    });

    it('returns empty array when no trails', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ trails: [] }) });
      const { getTrails } = await import('../../api/client.js');
      const result = await getTrails();
      expect(result).toEqual([]);
    });

    it('returns empty array when response has no trails key', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      const { getTrails } = await import('../../api/client.js');
      const result = await getTrails();
      expect(result).toEqual([]);
    });
  });

  describe('getTrailById', () => {
    it('fetches single trail by ID', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'trail-1', name: 'Rainier' }) });
      const { getTrailById } = await import('../../api/client.js');
      const result = await getTrailById('trail-1');
      expect(result).toEqual({ id: 'trail-1', name: 'Rainier' });
    });
  });

  describe('updateTrail', () => {
    it('sends PUT with API key from localStorage', async () => {
      localStorage.setItem('hiker-api-key', 'test-key-123');
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, trail: { id: 'trail-1', name: 'Updated' } }) });
      const { updateTrail } = await import('../../api/client.js');
      await updateTrail({ id: 'trail-1', name: 'Updated' });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/trails/trail-1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'X-API-Key': 'test-key-123' }),
          body: JSON.stringify({ id: 'trail-1', name: 'Updated' }),
        })
      );
    });

    it('sends empty API key when not set in localStorage', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, trail: { id: 'trail-1' } }) });
      const { updateTrail } = await import('../../api/client.js');
      await updateTrail({ id: 'trail-1' });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/trails/trail-1',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-API-Key': '' }),
        })
      );
    });
  });

  describe('deleteTrail', () => {
    it('sends DELETE with API key from localStorage', async () => {
      localStorage.setItem('hiker-api-key', 'test-key');
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
      const { deleteTrail } = await import('../../api/client.js');
      await deleteTrail('trail-1');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/trails/trail-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('getTrailDetails', () => {
    it('fetches all trail details', async () => {
      const details = { 'trail-1': { fullDescription: 'Test', leaders: [] } };
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve(details) });
      const { getTrailDetails } = await import('../../api/client.js');
      const result = await getTrailDetails();
      expect(result).toEqual(details);
    });
  });

  describe('getTrailDetailById', () => {
    it('fetches single trail detail by ID', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ fullDescription: 'Rainier trail' }) });
      const { getTrailDetailById } = await import('../../api/client.js');
      const result = await getTrailDetailById('trail-1');
      expect(result).toEqual({ fullDescription: 'Rainier trail' });
    });
  });

  describe('updateTrailDetail', () => {
    it('sends PUT with API key', async () => {
      localStorage.setItem('hiker-api-key', 'admin-key');
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
      const { updateTrailDetail } = await import('../../api/client.js');
      await updateTrailDetail('trail-1', { fullDescription: 'Updated' });
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/trails/details/trail-1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'X-API-Key': 'admin-key' }),
          body: JSON.stringify({ fullDescription: 'Updated' }),
        })
      );
    });
  });

  describe('getLookup', () => {
    it('fetches lookup data', async () => {
      const lookup = { difficulties: [{ code: 'Easy', label: 'Easy' }], parkingLevels: {} };
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve(lookup) });
      const { getLookup } = await import('../../api/client.js');
      const result = await getLookup();
      expect(result).toEqual(lookup);
    });
  });

  describe('getSchedule', () => {
    it('fetches schedule data', async () => {
      const schedule = { Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-1' }] };
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve(schedule) });
      const { getSchedule } = await import('../../api/client.js');
      const result = await getSchedule();
      expect(result).toEqual(schedule);
    });
  });

  describe('uploadSchedule', () => {
    it('uploads schedule file with FormData', async () => {
      localStorage.setItem('hiker-api-key', 'upload-key');
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, message: 'OK' }) });
      const { uploadSchedule } = await import('../../api/client.js');
      const mockFile = new File(['1\tHike\ttrail-1'], 'schedule.tsv', { type: 'text/tab-separated-values' });
      const result = await uploadSchedule(mockFile);
      expect(result).toEqual({ success: true, message: 'OK' });
    });

    it('throws on upload failure', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ error: { message: 'Invalid format' } }) });
      const { uploadSchedule } = await import('../../api/client.js');
      const mockFile = new File(['test'], 'test.tsv');
      await expect(uploadSchedule(mockFile)).rejects.toThrow('Invalid format');
    });

    it('uses empty API key when not set', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
      const { uploadSchedule } = await import('../../api/client.js');
      const mockFile = new File(['test'], 'test.tsv');
      await uploadSchedule(mockFile);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/schedule/upload',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-API-Key': '' }),
        })
      );
    });
  });

  describe('getScheduleReport', () => {
    it('fetches schedule report text', async () => {
      fetchSpy.mockResolvedValue({ ok: true, text: () => Promise.resolve('Report text') });
      const { getScheduleReport } = await import('../../api/client.js');
      const result = await getScheduleReport('Q1');
      expect(result).toBe('Report text');
    });

    it('throws on report failure', async () => {
      fetchSpy.mockRejectedValue(new Error('Bad request'));
      const { getScheduleReport } = await import('../../api/client.js');
      await expect(getScheduleReport('Q1')).rejects.toThrow();
    });
  });

  describe('getScheduleDownload', () => {
    it('fetches schedule download as blob', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/tab-separated-values' });
      fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) });
      const { getScheduleDownload } = await import('../../api/client.js');
      const result = await getScheduleDownload('Q1');
      expect(result).toBe(mockBlob);
    });
  });

  describe('request error handling', () => {
    it('throws on 404 response', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ error: { message: 'Trail not found' } }) });
      const { getTrailById } = await import('../../api/client.js');
      await expect(getTrailById('nonexistent')).rejects.toThrow('Trail not found');
    });

    it('throws generic error when JSON parse fails', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error('Server error')) });
      const { getTrails } = await import('../../api/client.js');
      await expect(getTrails()).rejects.toThrow('Request failed');
    });

    it('handles nested error message format', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({ success: false, error: { message: 'Unauthorized' } }) });
      const { getTrails } = await import('../../api/client.js');
      await expect(getTrails()).rejects.toThrow('Unauthorized');
    });
  });
});
