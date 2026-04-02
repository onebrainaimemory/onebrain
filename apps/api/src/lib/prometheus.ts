import { getMetricsSnapshot } from './metrics.js';
import { getClient } from '@onebrain/db';

/**
 * Generates a Prometheus-format metrics response.
 */
export async function getPrometheusMetrics(): Promise<string> {
  const snapshot = getMetricsSnapshot();
  const lines: string[] = [];

  lines.push('# HELP onebrain_request_count Total HTTP requests');
  lines.push('# TYPE onebrain_request_count counter');
  lines.push(`onebrain_request_count ${snapshot.requestCount}`);

  lines.push('# HELP onebrain_error_count Total HTTP error responses (5xx)');
  lines.push('# TYPE onebrain_error_count counter');
  lines.push(`onebrain_error_count ${snapshot.errorCount}`);

  lines.push('# HELP onebrain_request_duration_seconds Request duration in seconds');
  lines.push('# TYPE onebrain_request_duration summary');
  lines.push(
    `onebrain_request_duration_seconds{quantile="0.5"} ${snapshot.requestDuration.p50 / 1000}`,
  );
  lines.push(
    `onebrain_request_duration_seconds{quantile="0.95"} ${snapshot.requestDuration.p95 / 1000}`,
  );
  lines.push(
    `onebrain_request_duration_seconds{quantile="0.99"} ${snapshot.requestDuration.p99 / 1000}`,
  );
  lines.push(`onebrain_request_duration_seconds_avg ${snapshot.requestDuration.avg / 1000}`);

  lines.push('# HELP onebrain_db_query_count Total DB queries');
  lines.push('# TYPE onebrain_db_query_count counter');
  lines.push(`onebrain_db_query_count ${snapshot.dbQueryCount}`);

  // Memory entry count
  try {
    const prisma = getClient();
    const memoryCount = await prisma.memoryItem.count({ where: { deletedAt: null } });
    lines.push('# HELP onebrain_memory_entries_count Active memory entries');
    lines.push('# TYPE onebrain_memory_entries_count gauge');
    lines.push(`onebrain_memory_entries_count ${memoryCount}`);
  } catch {
    lines.push('# onebrain_memory_entries_count unavailable (db error)');
  }

  // Active connections
  try {
    const prisma = getClient();
    const connections = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
    `;
    const activeConns = Number(connections[0]?.count ?? 0);
    lines.push('# HELP onebrain_active_connections Active DB connections');
    lines.push('# TYPE onebrain_active_connections gauge');
    lines.push(`onebrain_active_connections ${activeConns}`);
  } catch {
    lines.push('# onebrain_active_connections unavailable');
  }

  lines.push(`# HELP onebrain_started_at Server start time`);
  lines.push(`# TYPE onebrain_started_at gauge`);
  lines.push(`onebrain_started_at{timestamp="${snapshot.startedAt}"} 1`);

  return lines.join('\n') + '\n';
}
