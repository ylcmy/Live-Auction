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
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ── Socket.IO v4 protocol helpers ───────────────────────────────────────────

const EIO_CONNECT = '0';
const EIO_PING    = '2';
const EIO_PONG    = '3';
const EIO_UPGRADE = '5';

const SIO_CONNECT      = '40';
const SIO_EVENT_PREFIX = '42';

type HandshakeState = 'eio-connect' | 'probe' | 'upgrade' | 'sio-connect' | 'connected';

interface SocketIOPacket {
  eioType: string;
  sioType?: string;
  event?: string;
  data?: any;
}

function parsePacket(msg: string): SocketIOPacket | null {
  if (typeof msg !== 'string' || msg.length === 0) return null;
  const eioType = msg[0];

  if (eioType === '4') {
    const sioPayload = msg.substring(1);
    if (sioPayload.length === 0) return { eioType };
    const sioType = sioPayload[0];

    if (sioType === '2' && sioPayload.length > 1) {
      try {
        const parsed = JSON.parse(sioPayload.substring(1));
        return { eioType, sioType, event: parsed[0], data: parsed[1] };
      } catch { return { eioType, sioType }; }
    }

    return { eioType, sioType };
  }

  return { eioType };
}

function emitEvent(socket: any, event: string, data: any) {
  socket.send(SIO_EVENT_PREFIX + '["' + event + '",' + JSON.stringify(data) + ']');
}

function performHandshake(socket: any, token: string): HandshakeState {
  socket.send(EIO_CONNECT + JSON.stringify({ token }));
  return 'probe';
}

function handleHandshakeStep(socket: any, packet: SocketIOPacket, state: HandshakeState): HandshakeState {
  switch (state) {
    case 'probe':
      if (packet.eioType === EIO_CONNECT) {
        socket.send('2probe');
        return 'upgrade';
      }
      break;
    case 'upgrade':
      if (packet.eioType === '3' || (packet.eioType === '4' && packet.sioType === '3')) {
        socket.send(EIO_UPGRADE);
        socket.send(SIO_CONNECT + '{}');
        return 'sio-connect';
      }
      break;
    case 'sio-connect':
      if (packet.eioType === '4' && packet.sioType === '0') {
        return 'connected';
      }
      break;
  }
  return state;
}

// ── Custom metrics ──────────────────────────────────────────────────────────
const connectSuccess = new Counter('ws_connect_success');
const connectError   = new Counter('ws_connect_error');
const handshakeOk    = new Counter('handshake_success');
const handshakeFail  = new Counter('handshake_error');
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
    non_business_errors:      ['rate<0.001'],
    ws_connect_latency:       ['p(95)<500'],
  },
};

// ── Setup: register and login users ─────────────────────────────────────────
export function setup() {
  const apiBase = __ENV.API_BASE || 'http://localhost:3001';
  const userCount = Number(__ENV.USER_COUNT || 200);
  const tokens: string[] = [];

  for (let i = 0; i < userCount; i++) {
    const username = `k6_smoke_${i}_${Date.now()}`;
    const password = 'Test1234!';
    const nickname = `SmokeUser${i}`;

    http.post(
      `${apiBase}/api/auth/register`,
      JSON.stringify({ username, password, nickname, role: 'user' }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    const loginRes = http.post(
      `${apiBase}/api/auth/login`,
      JSON.stringify({ username, password }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body as string);
        const token = body.data?.accessToken;
        if (token) tokens.push(token);
      } catch {}
    }
  }

  return { tokens };
}

// ── Default function (per-VU iteration) ─────────────────────────────────────
export default function (data: { tokens: string[] }) {
  if (data.tokens.length === 0) return;

  const userIndex = (__VU - 1) % data.tokens.length;
  const token = data.tokens[userIndex];
  const baseUrl = __ENV.WS_URL || 'ws://localhost:3001';
  const roomId = Number(__ENV.ROOM_ID || 1);
  const url = `${baseUrl}/socket.io/?EIO=4&transport=websocket`;

  const start = Date.now();

  const res = ws.connect(url, null, (socket) => {
    let hsState: HandshakeState = 'eio-connect';

    // ── Message handler ──
    socket.on('message', (msg: string) => {
      const packet = parsePacket(msg);
      if (!packet) return;

      if (packet.eioType === EIO_PING) {
        socket.send(EIO_PONG);
        return;
      }

      if (hsState !== 'connected') {
        const prev = hsState;
        hsState = handleHandshakeStep(socket, packet, hsState);
        if (hsState === 'connected' && prev !== 'connected') {
          wsLatency.add(Date.now() - start);
          handshakeOk.add(1);
          connectSuccess.add(1);
          onConnected();
        }
        return;
      }

      // countdown:tick, bid:new, rank:update — no-op, just keeping alive
    });

    // ── Socket open → handshake ──
    socket.on('open', () => {
      hsState = performHandshake(socket, token);

      socket.setTimeout(() => {
        if (hsState !== 'connected') {
          handshakeFail.add(1);
          socket.close();
        }
      }, 5000);
    });

    // ── Post-handshake: join room and hold ──
    function onConnected() {
      emitEvent(socket, 'auction:join', { roomId });

      const holdDuration = 3000 + Math.random() * 5000;
      socket.setTimeout(() => socket.close(), holdDuration);
    }

    socket.on('error', () => {});
  });

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
