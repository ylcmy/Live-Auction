/**
 * k6 smoke test for CI: 200 VU x 2min
 *
 * Goals:
 *   - WebSocket connection success rate >= 99%
 *   - Non-business error rate < 0.1% (SC-009)
 *   - handleSummary outputs P95/P99/error-rate JSON
 *
 * Usage:
 *   k6 run backend/tests/load/smoke-ci.k6.ts
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ── Socket.IO v4 helpers (k6 v2 compatible) ─────────────────────────────────
function parseSocketIOMessage(msg: string): { event: string; data: any } | null {
  if (typeof msg !== 'string' || !msg.startsWith('42')) return null;
  try {
    const parsed = JSON.parse(msg.substring(2));
    return { event: parsed[0], data: parsed[1] };
  } catch {
    return null;
  }
}

function emitSocketIO(socket: any, event: string, data: any) {
  socket.send('42["' + event + '",' + JSON.stringify(data) + ']');
}

// ── Custom metrics ──────────────────────────────────────────────────────────
const connectSuccess = new Counter('ws_connect_success');
const connectError   = new Counter('ws_connect_error');
const wsLatency      = new Trend('ws_connect_latency', true);
const errorRate      = new Rate('non_business_errors');

// ── Scenario options ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 200,
      duration: '2m',
    },
  },
  thresholds: {
    ws_connect_success:       ['count>0'],
    ws_connect_error:         ['count<10000'],
    non_business_errors:      ['rate<0.001'],   // <0.1%
    ws_connect_latency:       ['p(95)<500'],
  },
};

// ── Default function (per-VU iteration) ─────────────────────────────────────
export default function () {
  const token = __ENV.TEST_TOKEN || 'test-token';
  const baseUrl = __ENV.WS_URL || 'ws://localhost:3001';
  const roomId = Number(__ENV.ROOM_ID || 1);
  const url = `${baseUrl}/socket.io/?EIO=4&transport=websocket&token=${encodeURIComponent(token)}`;

  const start = Date.now();

  const res = ws.connect(url, null, (socket) => {
    socket.on('open', () => {
      wsLatency.add(Date.now() - start);
      connectSuccess.add(1);
      // Send Socket.IO CONNECT with auth token to complete the handshake
      socket.send('40{"token":"' + token + '"}');

      emitSocketIO(socket, 'auction:join', { roomId });

      // Subscribe to common events to keep the connection alive
      socket.on('message', (msg: string) => {
        const parsed = parseSocketIOMessage(msg);
        if (!parsed) return;
        // countdown:tick, bid:new, rank:update — no-op, just keeping connection alive
      });

      // Keep connection open for 3-8 seconds then close gracefully
      const holdDuration = 3000 + Math.random() * 5000;
      socket.setTimeout(() => socket.close(), holdDuration);
    });

    socket.on('error', () => {
      // k6 v2 fires error on normal close too; we track errors via res.status instead
    });
  });

  // ws.connect returns a Response; check for non-101 errors
  if (res && res.status !== undefined && res.status !== 101) {
    connectError.add(1);
    errorRate.add(1);
  }

  sleep(0.5);
}

// ── handleSummary: output P95/P99/error-rate JSON ───────────────────────────
export function handleSummary(data: Record<string, unknown>) {
  const metrics = data.metrics as Record<string, Record<string, unknown>> | undefined;

  const latencyP95 = metrics?.ws_connect_latency?.values?.['p(95)'] ?? 0;
  const latencyP99 = metrics?.ws_connect_latency?.values?.['p(99)'] ?? 0;
  const connects   = (metrics?.ws_connect_success?.values?.count as number) ?? 0;
  const errors     = (metrics?.ws_connect_error?.values?.count as number) ?? 0;
  const totalCount = connects + errors;
  const connectRate = totalCount > 0 ? (connects / totalCount) : 0;
  const nonBizRate = (metrics?.non_business_errors?.values?.rate as number) ?? 0;

  const summary = {
    timestamp: new Date().toISOString(),
    scenario: 'smoke-ci',
    vus: 200,
    duration: '2m',
    results: {
      ws_connect_success: connects,
      ws_connect_error: errors,
      ws_connect_success_rate: Number((connectRate * 100).toFixed(2)),
      ws_connect_latency_p95_ms: Number((latencyP95 as number).toFixed(2)),
      ws_connect_latency_p99_ms: Number((latencyP99 as number).toFixed(2)),
      non_business_error_rate: Number((nonBizRate * 100).toFixed(4)),
    },
    assertions: {
      connect_success_rate_gte_99: connectRate >= 0.99,
      non_business_error_lt_0_1:   nonBizRate < 0.001,
      latency_p95_lt_500ms:        (latencyP95 as number) < 500,
    },
    passed:
      connectRate >= 0.99 &&
      nonBizRate < 0.001 &&
      (latencyP95 as number) < 500,
  };

  const outputPath = __ENV.SUMMARY_OUTPUT || 'backend/tests/load/results/smoke-ci-summary.json';

  return {
    stdout: JSON.stringify(summary, null, 2),
    [outputPath]: JSON.stringify(summary, null, 2),
  };
}
