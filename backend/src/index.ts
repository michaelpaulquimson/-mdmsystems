import 'dotenv/config';
import 'express-async-errors';

import { createApp } from './app.js';
import { buildCompositionRoot } from './composition-root.js';
import { env } from './core/config/env.js';
import { migrate } from './core/db/migrate.js';
import { connectWithRetry, pool } from './core/db/pool.js';
import { seed } from './core/db/seed.js';
import { logger } from './core/logger/logger.js';
import { errorMiddleware } from './core/middleware/error.middleware.js';
import { notFoundMiddleware } from './core/middleware/not-found.middleware.js';
import { mountDocs } from './core/openapi/builder.js';

async function bootstrap(): Promise<void> {
  await connectWithRetry();

  if (env.NODE_ENV !== 'production') {
    await migrate(pool);
    await seed(pool);
  }

  const app = createApp();
  const { router, metricsHandler, healthReadyHandler } = buildCompositionRoot(pool);

  mountDocs(app);

  app.get('/health/ready', healthReadyHandler);
  app.get('/metrics', metricsHandler);
  app.use('/api/v1', router);

  // Error handlers must be last
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  const server = app.listen(env.BACKEND_PORT, () => {
    logger.info(`Backend listening on :${env.BACKEND_PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down`);
    // Force-exit after 10 s if graceful shutdown hangs
    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();
    server.close(async () => {
      await pool.end();
      logger.info('Shutdown complete');
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
