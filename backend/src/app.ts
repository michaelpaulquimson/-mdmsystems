import compression from 'compression';
import cors from 'cors';
import express, { json } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp, type Options as PinoHttpOptions } from 'pino-http';

import { env } from './core/config/env.js';
import { logger } from './core/logger/logger.js';

export function createApp(): express.Application {
  const app = express();

  // Trust the first proxy hop so express-rate-limit keys on the real client IP,
  // not the Docker/LB gateway IP (which would turn per-IP limits into global caps).
  app.set('trust proxy', 1);

  // ─── Security headers ────────────────────────────────────────────────────────
  // CSP relaxed on /api/v1/docs to allow Swagger UI inline scripts/styles
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/docs')) {
      return helmet({ contentSecurityPolicy: false })(req, res, next);
    }
    return helmet()(req, res, next);
  });

  // ─── CORS ─────────────────────────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
    }),
  );

  // ─── Body parsing + compression ──────────────────────────────────────────────
  app.use(json({ limit: '100kb' }));
  app.use(compression());

  // ─── Request logging ─────────────────────────────────────────────────────────
  const httpLogger = pinoHttp({
    logger,
    genReqId: () => crypto.randomUUID(),
  } satisfies PinoHttpOptions);
  app.use(httpLogger);

  // ─── Global rate limits ───────────────────────────────────────────────────────
  app.use(
    '/api/',
    rateLimit({
      windowMs: 60_000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => env.NODE_ENV === 'test',
      message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' } },
    }),
  );

  // ─── Health (intentionally unversioned) ──────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  return app;
}
