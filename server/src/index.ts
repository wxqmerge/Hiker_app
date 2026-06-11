import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

import { router as trailsRouter } from './routes/trails.routes.js';
import { router as scheduleRouter } from './routes/schedule.routes.js';
import { router as lookupRouter } from './routes/lookup.routes.js';
import { getWriteHealth, serverVersion } from './services/dataService.js';
import { buildVersion } from './utils/version.js';

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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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

app.get('/api/validate', async (_req, res) => {
  const fs = await import('fs/promises');
  const path = (await import('path')).default;
  const __filename = (await import('url')).fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const DATA_DIR = path.join(__dirname, '../exported_data');

  const results: Array<{ file: string; valid: boolean; error?: string; recordCount?: number }> = [];

  const filesToCheck = ['trails.json', 'trail_details.json', 'lookup.json', 'schedule.json'];
  for (const filename of filesToCheck) {
    const filePath = path.join(DATA_DIR, filename);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      let count: number | undefined;
      if (Array.isArray(parsed)) count = parsed.length;
      else if (parsed && typeof parsed === 'object') count = Object.keys(parsed).length;
      results.push({ file: filename, valid: true, recordCount: count });
    } catch (err) {
      results.push({ file: filename, valid: false, error: (err as Error).message });
    }
  }

  try {
    const historyDir = path.join(DATA_DIR, 'schedule_history');
    const files = await fs.readdir(historyDir);
    const historyFiles = files.filter(f => f.startsWith('schedule_') && f.endsWith('.json'));
    for (const filename of historyFiles) {
      const filePath = path.join(historyDir, filename);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        JSON.parse(content);
        results.push({ file: `schedule_history/${filename}`, valid: true });
      } catch (err) {
        results.push({ file: `schedule_history/${filename}`, valid: false, error: (err as Error).message });
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
