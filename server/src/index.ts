import dotenv from 'dotenv';
import path from 'path';
import { getCurrentDir } from './utils/path.js';

const __dirname = getCurrentDir(import.meta.url);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express, { Application, Request, Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';

import { router as trailsRouter } from './routes/trails.routes.js';
import { router as scheduleRouter } from './routes/schedule.routes.js';
import { router as lookupRouter } from './routes/lookup.routes.js';
import { router as dataRouter } from './routes/data.routes.js';
import { getWriteHealth, serverVersion, waitForDataReady } from './services/dataService.js';
import { buildVersion } from './utils/version.js';
import { requireAdminKey } from './middleware/auth.middleware.js';

const isDev = process.env.NODE_ENV !== 'production';

const { hash: buildHash, ts: buildTs, full: buildFull } = buildVersion();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.set('X-Build-Version', buildHash);
  res.set('X-Build-Timestamp', buildTs);
  next();
});

app.use((req, res, next) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, callback?: any) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    console.log(`[API] ${clientIp} ${req.method.padEnd(4)} ${req.path.padEnd(35)} ${status.toString().padStart(3)} ${duration}ms`);
    return originalEnd.call(res, chunk, encoding, callback);
  };
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { success: false, error: { message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(o => o) || [];
const allowAnyOrigin = corsOrigins.length === 0;
app.use(cors({
  origin: allowAnyOrigin ? true : corsOrigins,
  credentials: !allowAnyOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

app.use('/api', apiLimiter);
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/health', (_req: Request, res: Response) => {
  const wh = getWriteHealth();
  res.json({
    status: 'ok',
    version: serverVersion(),
    build: { hash: buildHash, ts: buildTs, full: buildFull },
    timestamp: new Date().toISOString(),
    writeHealth: {
      lastWriteTime: wh.lastWriteTime,
      lastWriteSuccess: wh.lastWriteSuccess,
      lastError: wh.lastError,
      consecutiveFailures: wh.consecutiveFailures,
    },
  });
});

app.get('/api/config', (req, res) => {
  const appName = req.headers['x-app-name'] || 'hiker';
  res.json({
    appName: String(appName),
    scheduleName: process.env.SCHEDULE_NAME || 'default',
    hikeDays: process.env.HIKE_DAYS || '3,5',
  });
});

app.get(/manifest\.webmanifest$/, (req, res) => {
  const appName = String(req.headers['x-app-name'] || 'hiker');
  const basePath = `/${appName}`;
  res.set('Content-Type', 'application/manifest+json');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json({
    name: appName,
    short_name: appName,
    description: 'Trail schedule, hike planning, weather and tide predictions',
    id: basePath,
    start_url: `${basePath}/`,
    scope: basePath,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#1b4332',
    icons: [
      { src: `${basePath}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${basePath}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${basePath}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
});

app.use('/api/trails', trailsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/lookup', lookupRouter);
app.use('/api/data', dataRouter);

app.post('/api/cleanup/orphaned-details', requireAdminKey, async (_req, res) => {
  const fs = await import('fs/promises');
  const path = (await import('path')).default;
  const __filename = (await import('url')).fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DATA_DIR = path.join(__dirname, '../../exported_data');

  const trailsPath = path.join(DATA_DIR, 'trails.json');
  const detailsPath = path.join(DATA_DIR, 'trail_details.json');

  const trailsData = JSON.parse(await fs.readFile(trailsPath, 'utf-8'));
  const trailIds = new Set((trailsData.trails || []).map((t: any) => t.id));

  const details = JSON.parse(await fs.readFile(detailsPath, 'utf-8'));
  const orphaned: string[] = [];
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (trailIds.has(key)) {
      cleaned[key] = value;
    } else {
      orphaned.push(key);
    }
  }
  if (orphaned.length > 0) {
    await fs.writeFile(detailsPath, JSON.stringify(cleaned, null, 2) + '\n', 'utf-8');
  }

  res.json({ removed: orphaned.length, orphaned });
});

app.get('/api/validate', async (_req, res) => {
  const fs = await import('fs/promises');
  const path = (await import('path')).default;
  const __filename = (await import('url')).fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DATA_DIR = path.join(__dirname, '../../exported_data');

    const MONTH_KEYS = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  const results: Array<{ file: string; valid: boolean; error?: string; recordCount?: number; issues?: string[] }> = [];

  function addResult(file: string, valid: boolean, opts?: { error?: string; recordCount?: number; issues?: string[] }) {
    results.push({ file, valid, ...opts });
  }

  let trails: any[] = [];

  // trails.json
  {
    const filePath = path.join(DATA_DIR, 'trails.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const issues: string[] = [];
      if (!parsed || typeof parsed !== 'object') {
        issues.push('root must be an object');
      } else if (!Array.isArray(parsed.trails)) {
        issues.push('missing "trails" array');
      } else if (parsed.trails.length === 0) {
        issues.push('"trails" array is empty');
      } else {
        const sample = parsed.trails[0];
        const requiredFields = ['id', 'name'];
        const missing = requiredFields.filter(f => !(f in sample));
        if (missing.length) issues.push(`trails[0] missing fields: ${missing.join(', ')}`);
        const nonStrings = parsed.trails.filter((t: any) => typeof t.id !== 'string' || !t.id);
        if (nonStrings.length) issues.push(`${nonStrings.length} trail(s) with invalid/missing "id"`);
      }
      if (Array.isArray(parsed?.trails)) trails = parsed.trails;
      addResult('trails.json', issues.length === 0, { recordCount: Array.isArray(parsed?.trails) ? parsed.trails.length : 0, issues: issues.length ? issues : undefined });
    } catch (err) {
      addResult('trails.json', false, { error: (err as Error).message });
    }
  }

  // trail_details.json
  {
    const filePath = path.join(DATA_DIR, 'trail_details.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const issues: string[] = [];
      if (!parsed || typeof parsed !== 'object') {
        issues.push('root must be an object keyed by trail ID');
      } else {
        const keys = Object.keys(parsed);
        if (keys.length === 0) {
          issues.push('object is empty');
        } else {
          const sample = parsed[keys[0]];
          if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
            issues.push(`values must be objects, got ${Array.isArray(sample) ? 'array' : typeof sample}`);
          }
        }
        // Check for orphaned detail entries (no matching trail)
        const trailIds = new Set(Array.isArray(trails) ? trails.map((t: any) => t.id) : []);
        const orphaned = keys.filter(k => !trailIds.has(k));
        if (orphaned.length > 0) {
          issues.push(`${orphaned.length} orphaned detail(s): ${orphaned.join(', ')}`);
        }
      }
      addResult('trail_details.json', issues.length === 0, { recordCount: parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0, issues: issues.length ? issues : undefined });
    } catch (err) {
      addResult('trail_details.json', false, { error: (err as Error).message });
    }
  }

  // lookup.json
  {
    const filePath = path.join(DATA_DIR, 'lookup.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const issues: string[] = [];
      if (!parsed || typeof parsed !== 'object') {
        issues.push('root must be an object');
      } else {
        if (!Array.isArray(parsed.difficulties)) issues.push('missing "difficulties" array');
        if (typeof parsed.parkingLevels !== 'object' || Array.isArray(parsed.parkingLevels)) issues.push('"parkingLevels" must be an object');
      }
      addResult('lookup.json', issues.length === 0, { recordCount: parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0, issues: issues.length ? issues : undefined });
    } catch (err) {
      addResult('lookup.json', false, { error: (err as Error).message });
    }
  }

    // schedule.json
    {
      const filePath = path.join(DATA_DIR, `schedule_${process.env.SCHEDULE_NAME || 'default'}.json`);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const issues: string[] = [];
        if (!parsed || typeof parsed !== 'object') {
          issues.push('root must be an object');
        } else {
          const keys = Object.keys(parsed);
          if (keys.length === 0) {
            issues.push('object is empty');
          } else {
            const invalidKeys = keys.filter(k => !MONTH_KEYS.has(k) && !YEAR_MONTH_RE.test(k));
            if (invalidKeys.length) issues.push(`invalid month keys: ${invalidKeys.join(', ')}`);
            const nonArrayEntries = keys.filter(k => !Array.isArray(parsed[k]));
            if (nonArrayEntries.length) issues.push(`month(s) with non-array values: ${nonArrayEntries.join(', ')}`);
            let totalScheduled = 0;
            for (const k of keys) {
              const entries = parsed[k];
              if (Array.isArray(entries)) {
                totalScheduled += entries.filter((e: any) => e?.trail_id).length;
              }
            }
            if (totalScheduled === 0) {
              issues.push('no scheduled hikes found — schedule is empty');
              issues.push('→ use TSV import (Import Hike Tsv) or ScheduleBuilder to add hikes, not direct JSON editing');
            }
          }
        }
        addResult(`schedule_${process.env.SCHEDULE_NAME || 'default'}.json`, issues.length === 0, { recordCount: parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0, issues: issues.length ? issues : undefined });
      } catch (err) {
        addResult(`schedule_${process.env.SCHEDULE_NAME || 'default'}.json`, false, { error: (err as Error).message });
      }
    }


  // schedule_history/*.json
  try {
    const historyDir = path.join(DATA_DIR, 'schedule_history');
    const files = await fs.readdir(historyDir);
    const historyFiles = files.filter(f => f.startsWith('schedule_') && f.endsWith('.json'));
    for (const filename of historyFiles) {
      const filePath = path.join(historyDir, filename);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const issues: string[] = [];
        if (!parsed?.schedule) {
          issues.push('missing "schedule" property');
        } else if (typeof parsed.schedule !== 'object') {
          issues.push('"schedule" must be an object');
        }
        addResult(`schedule_history/${filename}`, issues.length === 0, { issues: issues.length ? issues : undefined });
      } catch (err) {
        addResult(`schedule_history/${filename}`, false, { error: (err as Error).message });
      }
    }
  } catch {
    // schedule_history dir may not exist
  }

  // gpx_index.json
  {
    const filePath = path.join(DATA_DIR, 'gpx_index.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const issues: string[] = [];
      if (!parsed || typeof parsed !== 'object') {
        issues.push('root must be an object keyed by trail ID');
      } else {
        const keys = Object.keys(parsed);
        if (keys.length === 0) {
          issues.push('object is empty');
        }
      }
      addResult('gpx_index.json', issues.length === 0, { recordCount: parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0, issues: issues.length ? issues : undefined });
    } catch (err) {
      addResult('gpx_index.json', false, { error: (err as Error).message });
    }
  }

  // Cross-reference checks: trail IDs, GPX files, popularity data
  {
    const issues: string[] = [];
    try {
      const trailsContent = await fs.readFile(path.join(DATA_DIR, 'trails.json'), 'utf-8');
      const detailsContent = await fs.readFile(path.join(DATA_DIR, 'trail_details.json'), 'utf-8');
      const gpxContent = await fs.readFile(path.join(DATA_DIR, 'gpx_index.json'), 'utf-8');
      const trails: any[] = JSON.parse(trailsContent).trails || [];
      const details: any = JSON.parse(detailsContent);
      const gpxIndex: Record<string, string> = JSON.parse(gpxContent);

      // Check for duplicate trail IDs
      const trailIds = trails.map((t: any) => t.id);
      const idCounts: Record<string, number> = trailIds.reduce((acc, id: string) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {} as Record<string, number>);
      const duplicates = Object.entries(idCounts).filter(([, count]) => count > 1);
      if (duplicates.length) {
        issues.push(`Duplicate trail IDs: ${duplicates.map(([id]) => `"${id}" (${idCounts[id]} times)`).join(', ')}`);
      }

      // Check trail IDs missing from details
      const detailIds = new Set(Object.keys(details));
      const missingDetails = trails.filter((t: any) => !detailIds.has(t.id));
      if (missingDetails.length) {
        issues.push(`${missingDetails.length} trail(s) missing details: ${missingDetails.slice(0, 5).map((t: any) => `"${t.id}"`).join(', ')}${missingDetails.length > 5 ? ` (+${missingDetails.length - 5} more)` : ''}`);
      }

      // Check trail IDs with hasGpx but missing from gpx_index
      const gpxIds = new Set(Object.keys(gpxIndex));
      const hasGpxMissing = trails.filter((t: any) => t.hasGpx && !gpxIds.has(t.id));
      if (hasGpxMissing.length) {
        issues.push(`${hasGpxMissing.length} trail(s) have hasGpx=true but no GPX mapping: ${hasGpxMissing.slice(0, 5).map((t: any) => `"${t.id}"`).join(', ')}`);
      }

      // Check for GPX files that exist in index but not on disk
      const gpxDir = path.join(DATA_DIR, 'gpx');
      try {
        const gpxFilesOnDisk = await fs.readdir(gpxDir);
        const missingGpxFiles = Object.entries(gpxIndex).filter(([, filename]) => !gpxFilesOnDisk.includes(filename));
        if (missingGpxFiles.length) {
          issues.push(`${missingGpxFiles.length} GPX file(s) in index but missing on disk: ${missingGpxFiles.slice(0, 5).map(([id, file]) => `"${id}" (${file})`).join(', ')}`);
        }
        // Check for corrupted GPX files (too small)
        const corruptedGpx: string[] = [];
        for (const filename of gpxFilesOnDisk) {
          if (filename.endsWith('.gpx')) {
            const stat = await fs.stat(path.join(gpxDir, filename));
            if (stat.size < 100) {
              corruptedGpx.push(`${filename} (${stat.size} bytes)`);
            }
          }
        }
        if (corruptedGpx.length) {
          issues.push(`${corruptedGpx.length} corrupted GPX file(s) (too small): ${corruptedGpx.join(', ')}`);
        }
      } catch {
        // gpx dir may not exist
      }

      // Check popularity data structure
      const trailsWithPop = Object.entries(details).filter(([, v]: [string, any]) => v?.popularity?.monthly);
      const invalidMonthly = trailsWithPop.filter(([, v]: [string, any]) => !Array.isArray(v.popularity.monthly) || v.popularity.monthly.length !== 12);
      if (invalidMonthly.length) {
        issues.push(`${invalidMonthly.length} trail(s) with invalid monthly popularity data (must be 12-element array)`);
      }

      addResult('cross-reference', issues.length === 0, { recordCount: trails.length, issues: issues.length ? issues : undefined });
    } catch (err) {
      addResult('cross-reference', false, { error: (err as Error).message });
    }
  }

  const allValid = results.every(r => r.valid);
  res.json({ valid: allValid, results });
});

if (isDev) {
  app.use((_req, _res, next) => {
    const req = _req as http.IncomingMessage;
    const res = _res as http.ServerResponse;
    const proxyReq = http.request(
      { hostname: 'localhost', port: 5173, path: req.url || '/', method: req.method, headers: { ...req.headers, host: 'localhost:5173' } },
      proxyRes => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('[Proxy Error] Vite server unreachable:', err.message);
      res.statusCode = 502;
      res.end('Bad Gateway: Vite dev server is not responding.');
    });

    req.pipe(proxyReq);
  });
} else {
  app.use(express.static(path.join(__dirname, '../../dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
  });
}

const server = http.createServer(app);
const isMainModule = process.argv[1] && (path.basename(process.argv[1]).endsWith('index.ts') || path.basename(process.argv[1]).endsWith('index.js'));
if (isMainModule) {
  (async () => {
    await waitForDataReady();
    server.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  HIKER TRAIL APP SERVER`);
      console.log(`========================================\n`);
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ Build: ${buildFull}`);
      console.log(`✓ CORS Origins: ${process.env.CORS_ORIGINS || '*'}`);
      console.log(`✓ Admin API Key: ${process.env.ADMIN_API_KEY ? 'Enabled' : '⚠️  NOT SET'}`);
      console.log(`========================================\n`);
    });
  })();

  const gracefulShutdown = (signal: string) => {
    console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced exit after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
