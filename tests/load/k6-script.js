/**
 * k6 Load Test Script for OneBrain API.
 *
 * Usage:
 *   k6 run tests/load/k6-script.js
 *   k6 run --env SCENARIO=smoke tests/load/k6-script.js
 *   k6 run --env SCENARIO=load tests/load/k6-script.js
 *   k6 run --env SCENARIO=stress tests/load/k6-script.js
 *
 * Environment variables:
 *   BASE_URL  - API base URL (default: http://localhost:3001)
 *   SCENARIO  - Test scenario: smoke, load, stress (default: smoke)
 *   API_TOKEN - Bearer token for authenticated endpoints
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const SCENARIO = __ENV.SCENARIO || 'smoke';
const API_TOKEN = __ENV.API_TOKEN || '';

// Custom metrics
const errorRate = new Rate('errors');
const healthDuration = new Trend('health_duration', true);
const authDuration = new Trend('auth_duration', true);
const brainDuration = new Trend('brain_context_duration', true);

// Scenario configurations
const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 50 },
      { duration: '3m', target: 50 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '1m', target: 200 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    default: scenarios[SCENARIO] || scenarios.smoke,
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
    health_duration: ['p(95)<200'],
    auth_duration: ['p(95)<1000'],
    brain_context_duration: ['p(95)<800'],
  },
};

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }
  return headers;
}

export default function () {
  group('Health Check', () => {
    const response = http.get(`${BASE_URL}/health`);
    healthDuration.add(response.timings.duration);

    const isOk = check(response, {
      'health status 200': (r) => r.status === 200,
      'health response has status field': (r) => {
        const body = JSON.parse(r.body);
        return body.data && body.data.status !== undefined;
      },
      'health response time < 200ms': (r) => r.timings.duration < 200,
    });

    errorRate.add(!isOk);
  });

  group('Auth - Magic Link Request', () => {
    const uniqueEmail = `loadtest+${__VU}+${Date.now()}@example.com`;
    const payload = JSON.stringify({
      email: uniqueEmail,
      locale: 'en',
    });

    const response = http.post(`${BASE_URL}/v1/auth/magic-link`, payload, {
      headers: getHeaders(),
    });

    authDuration.add(response.timings.duration);

    const isOk = check(response, {
      'magic-link status 200': (r) => r.status === 200,
      'magic-link has data': (r) => {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      },
      'magic-link response time < 1s': (r) => r.timings.duration < 1000,
    });

    errorRate.add(!isOk);
  });

  if (API_TOKEN) {
    group('Brain Context (authenticated)', () => {
      const response = http.get(`${BASE_URL}/v1/brain/context?scope=brief`, {
        headers: getHeaders(),
      });

      brainDuration.add(response.timings.duration);

      const isOk = check(response, {
        'brain context status 200': (r) => r.status === 200,
        'brain context has data': (r) => {
          const body = JSON.parse(r.body);
          return body.data !== undefined;
        },
        'brain context response time < 800ms': (r) => r.timings.duration < 800,
      });

      errorRate.add(!isOk);
    });

    group('Memory List (authenticated)', () => {
      const response = http.get(`${BASE_URL}/v1/memory?limit=20`, { headers: getHeaders() });

      const isOk = check(response, {
        'memory list status 200': (r) => r.status === 200,
        'memory list has pagination': (r) => {
          const body = JSON.parse(r.body);
          return body.meta && body.meta.pagination !== undefined;
        },
        'memory list response time < 500ms': (r) => r.timings.duration < 500,
      });

      errorRate.add(!isOk);
    });
  }

  sleep(0.5);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    scenario: SCENARIO,
    baseUrl: BASE_URL,
    metrics: {
      httpReqDuration: {
        avg: data.metrics.http_req_duration?.values?.avg,
        p95: data.metrics.http_req_duration?.values?.['p(95)'],
        p99: data.metrics.http_req_duration?.values?.['p(99)'],
      },
      httpReqFailed: data.metrics.http_req_failed?.values?.rate,
      errorRate: data.metrics.errors?.values?.rate,
      totalRequests: data.metrics.http_reqs?.values?.count,
    },
  };

  return {
    stdout: JSON.stringify(summary, null, 2) + '\n',
    'tests/load/results.json': JSON.stringify(summary, null, 2),
  };
}
