/**
 * Simple in-process metrics collector.
 * Tracks request counts, durations, errors, and DB queries.
 * Exposed via GET /v1/admin/metrics (admin only).
 */

interface MetricsData {
  requestCount: number;
  errorCount: number;
  dbQueryCount: number;
  durations: number[];
  startedAt: string;
}

const metrics: MetricsData = {
  requestCount: 0,
  errorCount: 0,
  dbQueryCount: 0,
  durations: [],
  startedAt: new Date().toISOString(),
};

const MAX_DURATION_SAMPLES = 10000;

export function recordRequest(durationMs: number): void {
  metrics.requestCount += 1;
  metrics.durations.push(durationMs);
  if (metrics.durations.length > MAX_DURATION_SAMPLES) {
    metrics.durations.splice(0, metrics.durations.length - MAX_DURATION_SAMPLES);
  }
}

export function recordError(): void {
  metrics.errorCount += 1;
}

export function recordDbQuery(): void {
  metrics.dbQueryCount += 1;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)] ?? 0;
}

export function getMetricsSnapshot(): {
  requestCount: number;
  errorCount: number;
  dbQueryCount: number;
  errorRate: number;
  uptime: string;
  startedAt: string;
  requestDuration: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    sampleCount: number;
  };
} {
  const sorted = [...metrics.durations].sort((a, b) => a - b);

  const uptimeMs = Date.now() - new Date(metrics.startedAt).getTime();
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  const avg =
    sorted.length > 0
      ? Math.round((sorted.reduce((sum, val) => sum + val, 0) / sorted.length) * 100) / 100
      : 0;

  const errorRate =
    metrics.requestCount > 0
      ? Math.round((metrics.errorCount / metrics.requestCount) * 10000) / 10000
      : 0;

  return {
    requestCount: metrics.requestCount,
    errorCount: metrics.errorCount,
    dbQueryCount: metrics.dbQueryCount,
    errorRate,
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    startedAt: metrics.startedAt,
    requestDuration: {
      avg,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      sampleCount: sorted.length,
    },
  };
}

/**
 * Reset all metrics — used in tests.
 */
export function resetMetrics(): void {
  metrics.requestCount = 0;
  metrics.errorCount = 0;
  metrics.dbQueryCount = 0;
  metrics.durations = [];
  metrics.startedAt = new Date().toISOString();
}
