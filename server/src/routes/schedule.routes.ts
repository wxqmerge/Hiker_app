import { Router } from 'express';
import { getSchedule, updateSchedule, loadData, getScheduleHistory, restoreScheduleByTimestamp, getScheduleVersion } from '../services/dataService.js';
import { requireAdminKey } from '../middleware/auth.middleware.js';
import { ScheduleSchema, RestoreTimestampSchema } from '../middleware/validation.middleware.js';
import { withErrorTag } from '../middleware/error.middleware.js';
import fs from 'fs';
import path from 'path';
import { etagMatches } from '../utils/etagCompare.js';
import { DATA_DIR } from '../utils/paths.js';

const router = Router();

router.get('/group', (_req, res) => {
  res.json({
    name: process.env.SCHEDULE_NAME || 'default',
    hikeDays: process.env.HIKE_DAYS || '3,5',
    maxHikesPerDay: parseInt(process.env.MAX_HIKES_PER_DAY || '3', 10) || 3,
    minSpeedMph: parseFloat(process.env.MIN_SPEED_MPH || '2.2'),
    maxSpeedMph: parseFloat(process.env.MAX_SPEED_MPH || '1.1'),
    isBikeTrip: process.env.IS_BIKE_TRIP === 'true'
  });
});

router.post('/reload', requireAdminKey, withErrorTag('SCHEDULE')(async (_req, res) => {
  await loadData();
  const schedule = getSchedule();
  const hasHikes = Object.keys(schedule).reduce((sum, key) => sum + (Array.isArray(schedule[key]) ? schedule[key].length : 0), 0);
  const message = hasHikes > 0
    ? 'Schedule and trail data reloaded from disk'
    : 'Schedule and trail data reloaded from disk — → use TSV import (Import Hike Tsv) or ScheduleBuilder to add hikes';
  res.json({ success: true, message });
}));

router.get('/', (req, res) => {
  const schedule = getSchedule();
  const version = getScheduleVersion();
  if (version && etagMatches(req.headers['if-none-match'] as string | undefined, version)) {
    return res.status(304).end();
  }
  if (version) {
    res.set('ETag', version);
  }
  res.json(schedule);
});

router.put('/', requireAdminKey, withErrorTag('SCHEDULE')(async (req, res) => {
  const result = ScheduleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: { message: 'Invalid schedule data', details: result.error.issues } });
  }
  const entryCount = Object.values(result.data).reduce((n: number, entries: any) => n + (Array.isArray(entries) ? entries.length : 0), 0);
  console.log('[SCHEDULE] PUT schedule -', entryCount, 'entries');
  const oldSchedule = getSchedule();
  const oldCount = Object.values(oldSchedule).reduce((n: number, entries: any) => n + (Array.isArray(entries) ? entries.length : 0), 0);
  console.log('[SCHEDULE] Previous:', oldCount, 'entries');
  if (entryCount === 0 && req.headers['x-confirm-empty'] !== 'true' && req.headers['x-confirm-empty'] !== '1') {
    console.warn('[SCHEDULE] Refusing to save empty schedule without confirmation');
    return res.status(400).json({ success: false, error: { message: 'Refusing to save an empty schedule. Use an explicit clear action to confirm.' } });
  }
  await updateSchedule(result.data);
  const newVersion = getScheduleVersion();
  console.log('[SCHEDULE] Save complete, new version:', newVersion.substring(0, 8));
  res.json({ success: true, etag: newVersion });
}));

router.get('/history', withErrorTag('SCHEDULE')(async (_req, res) => {
  const history = await getScheduleHistory();
  res.json(history);
}));

router.post('/history/restore', requireAdminKey, withErrorTag('SCHEDULE')(async (req, res) => {
  const result = RestoreTimestampSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: { message: 'Invalid restore request' } });
  }
  const restored = await restoreScheduleByTimestamp(result.data.timestamp);
  res.json({ success: true, schedule: restored });
}));
 
router.get('/ensure-writable', requireAdminKey, withErrorTag('SCHEDULE')(async (_req, res) => {
  const dataDir = DATA_DIR;
  const files = await fs.promises.readdir(dataDir);
  const results: Array<{ file: string; success: boolean; error?: string }> = [];

  for (const file of files) {
    if (file === 'schedule_history') continue;
    const filePath = path.join(dataDir, file);
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isDirectory) {
        // 0o664: owner (deploy user) rw, group (www-data) rw, other r.
        // Matches deploy/update.sh permissions. Group ownership is set by the deploy script.
        await fs.promises.chmod(filePath, 0o664);
        results.push({ file, success: true });
      }
    } catch (error) {
      results.push({ file, success: false, error: (error as Error).message });
    }
  }

  res.json({ success: true, results });
}));

export { router };
