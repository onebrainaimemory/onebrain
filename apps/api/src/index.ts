import { buildApp } from './app.js';
import { config } from './config.js';
import { disconnect } from '@onebrain/db';

const SHUTDOWN_TIMEOUT = 30_000; // 30 seconds max for graceful shutdown

async function start() {
  const app = await buildApp();

  // Catch unhandled errors at process level
  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });

  try {
    await app.listen({ port: config.api.port, host: config.api.host });
    app.log.info(`OneBrain API running on ${config.api.host}:${config.api.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    app.log.info(`Received ${signal} — shutting down gracefully`);

    // Clear all background job intervals
    const jobTimers = (app as unknown as Record<string, unknown>)['jobTimers'] as
      | NodeJS.Timeout[]
      | undefined;
    if (jobTimers) {
      for (const timer of jobTimers) {
        clearInterval(timer);
      }
    }

    // Force exit after timeout
    const forceTimer = setTimeout(() => {
      app.log.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
    forceTimer.unref();

    try {
      await app.close();
      app.log.info('HTTP server closed');
      await disconnect();
      app.log.info('Database disconnected');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
