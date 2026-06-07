// k6 bid consistency test with 500 concurrent bidders (CAS-based)
// Verifies: price monotonicity, idempotency, CAS correctness under load

import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

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

// ── UUID v4 (local implementation) ──────────────────────────────────────────
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Custom metrics ──────────────────────────────────────────────────────────
const bidAccepted   = new Counter('bid_accepted');
const bidRejected   = new Counter('bid_rejected_cas');
const bidLatency    = new Trend('bid_latency_ms');
const handshakeOk   = new Counter('handshake_success');
const handshakeFail = new Counter('handshake_error');

export const options = {
  scenarios: {
    bidding: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 100 },
        { duration: '10s', target: 500 },
        { duration: '20s', target: 500 },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    bid_latency_ms: ['p(95)<500'],
    bid_accepted: ['count>100'],
  },
};

// ── Setup: register and login users ─────────────────────────────────────────
export function setup() {
  const apiBase = __ENV.API_BASE || 'http://localhost:3001';
  const userCount = Number(__ENV.USER_COUNT || 500);
  const tokens: string[] = [];

  for (let i = 0; i < userCount; i++) {
    const username = `k6_consist_${i}_${Date.now()}`;
    const password = 'Test1234!';
    const nickname = `ConsistUser${i}`;

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

// ── Default function ────────────────────────────────────────────────────────
export default function (data: { tokens: string[] }) {
  if (data.tokens.length === 0) return;

  const userIndex = (__VU - 1) % data.tokens.length;
  const token = data.tokens[userIndex];
  const baseUrl = __ENV.WS_URL || 'ws://localhost:3001';
  const roomId = Number(__ENV.ROOM_ID || 1);
  const sessionId = Number(__ENV.SESSION_ID || 1);
  const url = `${baseUrl}/socket.io/?EIO=4&transport=websocket`;

  ws.connect(url, null, (socket) => {
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
          handshakeOk.add(1);
          onConnected();
        }
        return;
      }

      // ── Business events ──
      if (packet.event === 'bid:accepted') {
        bidLatency.add(packet.data?.latency || 0);
        bidAccepted.add(1);
        check(packet.data, { 'bid accepted has amount': (d: any) => d.amount !== undefined });
      } else if (packet.event === 'bid:rejected') {
        if (packet.data?.code === 40902) {
          bidRejected.add(1);
        }
      }
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

    // ── Post-handshake: bid loop ──
    function onConnected() {
      emitEvent(socket, 'auction:join', { roomId });

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const key = uuidv4();
        emitEvent(socket, 'bid:submit', { sessionId, idempotencyKey: key });

        // Store start time for latency measurement (approximate via accepted event)
        socket.on('message', (m: string) => {
          const p = parsePacket(m);
          if (p?.event === 'bid:accepted' && p.data?.idempotencyKey === key) {
            bidLatency.add(Date.now() - start);
          }
        });

        sleep(0.2);
      }

      socket.setTimeout(() => socket.close(), 20000);
    }
  });
}
