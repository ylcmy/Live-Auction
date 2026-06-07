/**
 * k6 WebSocket concurrency test (multi-user)
 *
 * Simulates multiple distinct users connecting to the same room concurrently,
 * measuring connection success rate, message delivery, and countdown drift.
 *
 * Modes (controlled by K6_SCENARIO env var):
 *   - default / "quick" : ramping to 500 VU over 50s (CI-friendly)
 *   - "full"            : 1000 VU x 5min, samples countdown remainingMs P95 <100ms
 *
 * Usage:
 *   k6 run backend/tests/load/ws-concurrency.k6.ts
 *   K6_SCENARIO=full k6 run backend/tests/load/ws-concurrency.k6.ts
 *
 * Environment variables:
 *   API_BASE    - API base URL (default http://localhost:3001)
 *   WS_URL      - WebSocket URL (default ws://localhost:3001)
 *   ROOM_ID     - Room ID
 *   K6_SCENARIO - quick or full
 *   USER_COUNT  - Number of users to register (default matches target VU)
 */

import ws from 'k6/ws';
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// ── Socket.IO v4 protocol helpers ───────────────────────────────────────────

const EIO_CONNECT = '0';
const EIO_PING    = '2';
const EIO_PONG    = '3';
const EIO_UPGRADE = '5';

const SIO_CONNECT     = '40';
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
const connectSuccess   = new Counter('ws_connect_success');
const connectError     = new Counter('ws_connect_error');
const handshakeSuccess = new Counter('handshake_success');
const handshakeError   = new Counter('handshake_error');
const countdownDrift   = new Trend('countdown_remaining_ms_drift', true);
const participantCount = new Trend('room_participant_count', true);
const messageReceived  = new Counter('ws_message_received');

// ── Scenario selection ──────────────────────────────────────────────────────
const scenario = __ENV.K6_SCENARIO || 'quick';

function getMaxVU(): number {
  if (scenario === 'full') return 1000;
  return 500;
}

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
        ws_connect_success:           ['count>0'],
        ws_connect_error:             ['count<10000'],
        countdown_remaining_ms_drift: ['p(95)<100'],
        room_participant_count:       ['min>0'],
      },
    };
  }

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
      ws_connect_success:     ['count>0'],
      ws_connect_error:       ['count<10000'],
      room_participant_count: ['min>0'],
    },
  };
}

export const options = getOptions();

// ── Setup: register and login multiple users ────────────────────────────────
export function setup() {
  const apiBase = __ENV.API_BASE || 'http://localhost:3001';
  const maxVU = getMaxVU();
  const userCount = Number(__ENV.USER_COUNT || maxVU);
  const tokens: string[] = [];

  for (let i = 0; i < userCount; i++) {
    const username = `k6_wsuser_${i}_${Date.now()}`;
    const password = 'Test1234!';
    const nickname = `WsUser${i}`;

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
      } catch {
        // Skip on parse failure
      }
    }
  }

  if (tokens.length === 0) {
    throw new Error('Failed to register/login any users. Check API_BASE and server status.');
  }

  return { tokens };
}

// ── Default function ────────────────────────────────────────────────────────
export default function (data: { tokens: string[] }) {
  if (data.tokens.length === 0) return;

  const userIndex = (__VU - 1) % data.tokens.length;
  const token = data.tokens[userIndex];
  const baseUrl = __ENV.WS_URL || 'ws://localhost:3001';
  const roomId = Number(__ENV.ROOM_ID || 1);
  const url = `${baseUrl}/socket.io/?EIO=4&transport=websocket`;

  const res = ws.connect(url, null, (socket) => {
    let hsState: HandshakeState = 'eio-connect';

    // ── Message handler (registered before any sends) ──
    socket.on('message', (msg: string) => {
      const packet = parsePacket(msg);
      if (!packet) return;

      // Handle Engine.IO ping
      if (packet.eioType === EIO_PING) {
        socket.send(EIO_PONG);
        return;
      }

      // Handle handshake steps
      if (hsState !== 'connected') {
        const prev = hsState;
        hsState = handleHandshakeStep(socket, packet, hsState);
        if (hsState === 'connected' && prev !== 'connected') {
          handshakeSuccess.add(1);
          onConnected();
        }
        return;
      }

      // ── Business events (post-handshake) ──
      messageReceived.add(1);

      if (packet.event === 'room:count') {
        if (packet.data && typeof packet.data.participantCount === 'number') {
          participantCount.add(packet.data.participantCount);
        }
      }

      if (scenario === 'full' && packet.event === 'countdown:tick') {
        if (packet.data && typeof packet.data.remainingMs === 'number') {
          const drift = Math.abs(packet.data.remainingMs % 1000);
          countdownDrift.add(drift > 500 ? 1000 - drift : drift);
        }
      }
    });

    // ── Socket open → start handshake ──
    socket.on('open', () => {
      connectSuccess.add(1);
      hsState = performHandshake(socket, token);

      socket.setTimeout(() => {
        if (hsState !== 'connected') {
          handshakeError.add(1);
          socket.close();
        }
      }, 5000);
    });

    // ── Post-handshake: join room and hold connection ──
    function onConnected() {
      emitEvent(socket, 'auction:join', { roomId });

      const holdDuration = scenario === 'full'
        ? 10000 + Math.random() * 20000
        : 5000 + Math.random() * 10000;
      socket.setTimeout(() => socket.close(), holdDuration);
    }

    socket.on('error', () => {
      // k6 v2 fires error on normal close too; track via res.status
    });
  });

  if (res && res.status !== undefined && res.status !== 101) {
    connectError.add(1);
  }

  sleep(0.5);
}
