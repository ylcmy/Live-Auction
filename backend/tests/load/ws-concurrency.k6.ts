/**
 * k6 WebSocket concurrency test
 *
 * Modes (controlled by K6_SCENARIO env var):
 *   - default / "quick" : ramping to 500 VU over 50s (CI-friendly)
 *   - "full"            : 1000 VU x 5min, samples countdown remainingMs P95 <100ms
 *
 * Usage:
 *   k6 run backend/tests/load/ws-concurrency.k6.ts
 *   K6_SCENARIO=full k6 run backend/tests/load/ws-concurrency.k6.ts
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

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
const connectSuccess   = new Counter('ws_connect_success');
const connectError     = new Counter('ws_connect_error');
const countdownDrift   = new Trend('countdown_remaining_ms_drift', true);

// ── Scenario selection ──────────────────────────────────────────────────────
const scenario = __ENV.K6_SCENARIO || 'quick';

function getOptions() {
  if (scenario === 'full') {
    return {
      scenarios: {
        full_load: {
          executor: 'constant-vus',
          vus: 1000,
          duration: '5m',
        },
      },
      thresholds: {
        ws_connect_success:              ['count>0'],
        ws_connect_error:                ['count<10000'],
        countdown_remaining_ms_drift:    ['p(95)<100'],
      },
    };
  }

  // Default "quick" scenario — CI-friendly ramping
  return {
    scenarios: {
      quick: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 100 },
          { duration: '30s', target: 500 },
          { duration: '10s', target: 0 },
        ],
      },
    },
    thresholds: {
      ws_connect_success: ['count>0'],
      ws_connect_error:   ['count<10000'],
    },
  };
}

export const options = getOptions();

// ── Default function ────────────────────────────────────────────────────────
export default function () {
  const token = __ENV.TEST_TOKEN || 'test-token';
  const baseUrl = __ENV.WS_URL || 'ws://localhost:3001';
  const roomId = Number(__ENV.ROOM_ID || 1);
  const url = `${baseUrl}/socket.io/?EIO=4&transport=websocket&token=${encodeURIComponent(token)}`;

  const res = ws.connect(url, null, (socket) => {
    socket.on('open', () => {
      connectSuccess.add(1);
      // Send Socket.IO CONNECT with auth token to complete the handshake
      socket.send('40{"token":"' + token + '"}');
      emitSocketIO(socket, 'auction:join', { roomId });

      socket.on('message', (msg: string) => {
        const parsed = parseSocketIOMessage(msg);
        if (!parsed) return;

        // In full mode, sample countdown drift
        if (scenario === 'full' && parsed.event === 'countdown:tick') {
          const data = parsed.data;
          if (data && typeof data.remainingMs === 'number') {
            const drift = Math.abs(data.remainingMs % 1000);
            const clampedDrift = drift > 500 ? 1000 - drift : drift;
            countdownDrift.add(clampedDrift);
          }
        }

        // bid:new, rank:update — no-op, just keeping connection alive
      });

      // Hold connection: full mode keeps it open longer
      const holdDuration = scenario === 'full'
        ? 10000 + Math.random() * 20000
        : 5000 + Math.random() * 10000;
      socket.setTimeout(() => socket.close(), holdDuration);
    });

    socket.on('error', () => {
      // k6 v2 fires error on normal close too; we track errors via res.status instead
    });
  });

  if (res && res.status !== undefined && res.status !== 101) {
    connectError.add(1);
  }

  sleep(0.5);
}
