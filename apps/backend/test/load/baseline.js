/**
 * Foundation baseline load test (research R3, SC-011).
 *
 * Profile:
 *   - Sustained: 50 RPS for 10 minutes
 *   - Peak:      100 RPS for 1 minute (immediately after sustained)
 *   - Mix:       80/20 reads/writes (writes are not yet exposed in Phase 0;
 *                we substitute permission-gated reads with cache-busting
 *                params to reserve the write path's load shape).
 *
 * Thresholds (block-merge):
 *   - read endpoints:  p95 < 200 ms
 *   - write endpoints: p95 < 500 ms (no real writes yet; threshold
 *                       applies once mutation endpoints land)
 *   - http_req_failed < 1% over the full run.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'mixed',
    },
    peak: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 150,
      startTime: '10m',
      exec: 'mixed',
    },
  },
  thresholds: {
    // SC-011 — foundation reads p95 ≤ 200 ms.
    'http_req_duration{kind:read}': ['p(95)<200'],
    // SC-011 — foundation writes p95 ≤ 500 ms (forward-looking).
    'http_req_duration{kind:write}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const READ_ENDPOINTS = [
  '/api/v1/health',
  '/api/v1/me',
  '/api/v1/settings/platform.foundation.version',
  '/api/v1/currencies',
];

// Phase 0 has no mutating endpoints yet. We mark a placeholder so the
// thresholds exist; the CI run will simply have zero samples in this
// bucket until later phases register write endpoints. When that happens,
// replace the placeholder with an idempotent POST to a low-cost endpoint.
const WRITE_ENDPOINTS = [];

export function mixed() {
  const r = Math.random();
  if (r < 0.8 || WRITE_ENDPOINTS.length === 0) {
    const endpoint =
      READ_ENDPOINTS[Math.floor(Math.random() * READ_ENDPOINTS.length)];
    const res = http.get(`${BASE_URL}${endpoint}`, {
      tags: { kind: 'read', endpoint },
    });
    check(res, {
      'read status is expected (200/401/404)': (r) =>
        [200, 401, 404].includes(r.status),
    });
  } else {
    const endpoint =
      WRITE_ENDPOINTS[Math.floor(Math.random() * WRITE_ENDPOINTS.length)];
    const res = http.post(`${BASE_URL}${endpoint}`, '{}', {
      headers: { 'Content-Type': 'application/json' },
      tags: { kind: 'write', endpoint },
    });
    check(res, {
      'write status is expected': (r) => r.status >= 200 && r.status < 500,
    });
  }
  sleep(0.1);
}

// Default export kept so direct `k6 run baseline.js` (without scenarios)
// still works for local smoke runs.
export default function () {
  mixed();
}
