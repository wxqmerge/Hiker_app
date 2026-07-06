import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

import express, { Application, Request, Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

import { router as trailsRouter } from './routes/trails.routes.js';
import { router as scheduleRouter } from './routes/schedule.routes.js';
import { router as lookupRouter } from './routes/lookup.routes.js';
import { router as dataRouter } from './routes/data.routes.js';
import { getWriteHealth, serverVersion } from './services/dataService.js';
import { buildVersion } from './utils/version.js';
import { requireAdminKey } from './middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV !== 'production';

const { hash: buildHash, ts: buildTs, full: buildFull } = buildVersion();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.set('trust proxy', 1);

app.use((req, res, next) => {
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

const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(o => o) || ['*'];
app.use(cors({
  origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? '*' : corsOrigins,
  credentials: true,
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

app.use('/api/trails', trailsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/lookup', lookupRouter);
app.use('/api/data', dataRouter);

app.get('/api/validate', requireAdminKey, async (_req, res) => {
  const fs = await import('fs/promises');
  const path = (await import('path')).default;
  const __filename = (await import('url')).fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DATA_DIR = path.join(__dirname, '../../exported_data');

  const MONTH_KEYS = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  const results: Array<{ file: string; valid: boolean; error?: string; recordCount?: number; issues?: string[] }> = [];

  function addResult(file: string, valid: boolean, opts?: { error?: string; recordCount?: number; issues?: string[] }) {
    results.push({ file, valid, ...opts });
  }

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
    const filePath = path.join(DATA_DIR, 'schedule.json');
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
          const invalidKeys = keys.filter(k => !MONTH_KEYS.has(k));
          if (invalidKeys.length) issues.push(`invalid month keys: ${invalidKeys.join(', ')}`);
          const nonArrayEntries = keys.filter(k => !Array.isArray(parsed[k]));
          if (nonArrayEntries.length) issues.push(`month(s) with non-array values: ${nonArrayEntries.join(', ')}`);
        }
      }
      addResult('schedule.json', issues.length === 0, { recordCount: parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0, issues: issues.length ? issues : undefined });
    } catch (err) {
      addResult('schedule.json', false, { error: (err as Error).message });
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
