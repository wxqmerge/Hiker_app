import { Router } from 'express';
import type { Request, Response } from 'express';

export const router = Router();

// NOAA predictions product: interval=hilo returns only high/low events;
// omitting interval returns the 6-minute water-level series (only some
// stations publish it — the rest answer 200 with an error body, which the
// client must treat as "no levels available").
const TIDE_MODES = new Set(['hilo', 'levels']);

router.get('/tide-proxy', async (req: Request, res: Response) => {
  const station = String(req.query.station || '');
  const beginDate = String(req.query.begin_date || '');
  const endDate = String(req.query.end_date || '');
  const mode = String(req.query.mode || 'hilo');
  if (!station || !beginDate || !endDate) {
    res.status(400).json({ error: 'station, begin_date, and end_date are required' });
    return;
  }
  // NOAA expects YYYYMMDD; anything else is a guaranteed upstream error.
  if (!/^\d{8}$/.test(beginDate) || !/^\d{8}$/.test(endDate)) {
    res.status(400).json({ error: 'begin_date and end_date must be YYYYMMDD' });
    return;
  }
  if (!TIDE_MODES.has(mode)) {
    res.status(400).json({ error: 'mode must be one of: hilo, levels' });
    return;
  }
  const url = new URL('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');
  url.searchParams.set('product', 'predictions');
  url.searchParams.set('datum', 'MLLW');
  if (mode === 'hilo') url.searchParams.set('interval', 'hilo');
  url.searchParams.set('begin_date', beginDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('station', station);
  url.searchParams.set('time_zone', 'lst_ldt');
  url.searchParams.set('units', 'english');
  url.searchParams.set('format', 'json');
  try {
    // Bounded wait: a stalled NOAA connection must not pin sockets open.
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Upstream error' });
      return;
    }
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    const timedOut = (err as Error)?.name === 'TimeoutError';
    res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'Upstream timeout' : 'Failed to fetch from NOAA' });
  }
});
