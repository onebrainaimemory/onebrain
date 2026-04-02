/**
 * Standalone retention worker.
 *
 * Runs the retention cleanup job on a configurable interval.
 * Use this instead of the in-process retention job when running
 * multiple API instances to avoid duplicate cleanup runs.
 *
 * Usage:
 *   DATABASE_URL=... RETENTION_INTERVAL_HOURS=6 tsx src/workers/retention-worker.ts
 *
 * In Docker:
 *   Set DISABLE_RETENTION_JOB=true on the API container
 *   Run this as a separate service with the same DATABASE_URL
 */
import { runRetentionCleanup } from '../services/retention.service.js';
import { disconnect } from '@onebrain/db';

const intervalHours = parseInt(process.env['RETENTION_INTERVAL_HOURS'] ?? '6', 10);
const intervalMs = intervalHours * 60 * 60 * 1000;

async function run() {
  try {
    const result = await runRetentionCleanup();
    console.info(
      JSON.stringify({
        level: 'info',
        msg: 'Retention cleanup completed',
        timestamp: new Date().toISOString(),
        ...result,
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'Retention cleanup failed',
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

// Run immediately, then at interval
run();
const timer = setInterval(run, intervalMs);

console.info(
  JSON.stringify({
    level: 'info',
    msg: `Retention worker started (interval: ${intervalHours}h)`,
    timestamp: new Date().toISOString(),
  }),
);

// Graceful shutdown
process.on('SIGINT', async () => {
  clearInterval(timer);
  await disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  clearInterval(timer);
  await disconnect();
  process.exit(0);
});
