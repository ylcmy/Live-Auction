/**
 * k6 multi-user concurrent bidding test
 *
 * Simulates multiple distinct users bidding concurrently on the same auction
 * session, measuring end-to-end latency, broadcast latency, and rank sync
 * latency across the cluster.
 *
 * Modes (controlled by K6_SCENARIO env var):
 *   - default / "quick" : 20 VU x 30s (ramping-vus, CI-friendly)
 *   - "full"            : 50 VU x 5min (constant-vus, pre-release)
 *
 * Usage:
 *   k6 run backend/tests/load/multi-user-bid.k6.ts
 *   K6_SCENARIO=full k6 run backend/tests/load/multi-user-bid.k6.ts
 *
 * Environment variables:
 *   API_BASE   - API base URL (default http://localhost:3001)
 *   WS_URL     - WebSocket URL (default ws://localhost:3001)
 *   ROOM_ID    - Room ID
 *   SESSION_ID - Auction session ID
 *   K6_SCENARIO - quick or full
 *   USER_COUNT  - Number of users to register (default 20)
 */

import ws from 'k6/ws';
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Socket.IO v4 protocol helpers ───────────────────────────────────────────

// Engine.IO packet types: 0=open, 1=close, 2=ping, 3=pong, 4=message, 5=upgrade, 6=noop
// Socket.IO packet types (under EIO 4=message): 0=CONNECT, 1=DISCONNECT, 2=EVENT, 3=ACK, 4=ERROR

const EIO_CONNECT  = '0';
const EIO_PING     = '2';
const EIO_PONG     = '3';
const EIO_UPGRADE  = '5';

const SIO_CONNECT  = '40';
const SIO_EVENT_PREFIX = '42';

// Handshake state machine
type HandshakeState = 'eio-connect' | 'probe' | 'upgrade' | 'sio-connect' | 'connected';

interface SocketIOPacket {
  eioType: string;     // Engine.IO packet type ('0','2','3','4','5','6')
  sioType?: string;    // Socket.IO packet type (only when eioType='4')
  event?: string;      // Event name (only for sio events)
  data?: any;          // Event payload
}

function parsePacket(msg: string): SocketIOPacket | null {
  if (typeof msg !== 'string' || msg.length === 0) return null;
  const eioType = msg[0];

  if (eioType === '4') {
    // Engine.IO message → parse Socket.IO layer
    const sioPayload = msg.substring(1);
    if (sioPayload.length === 0) return { eioType };
    const sioType = sioPayload[0];

    if (sioType === '2' && sioPayload.length > 1) {
      // EVENT: 42["event",{data}]
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
  // Step 1: Send Engine.IO CONNECT with auth
  socket.send(EIO_CONNECT + JSON.stringify({ token }));
  return 'probe';
}

function handleHandshakeStep(socket: any, packet: SocketIOPacket, state: HandshakeState): HandshakeState {
  switch (state) {
    case 'probe':
      // Step 2: Received EIO OPEN → send probe
      if (packet.eioType === EIO_CONNECT) {
        socket.send('2probe');
        return 'upgrade';
      }
      break;
    case 'upgrade':
      // Step 3: Received probe response → send upgrade
      if (packet.eioType === '3' || (packet.eioType === '4' && packet.sioType === '3')) {
        socket.send(EIO_UPGRADE);
        // Step 4: Send Socket.IO CONNECT
        socket.send(SIO_CONNECT + '{}');
        return 'sio-connect';
      }
      break;
    case 'sio-connect':
      // Step 5: Received Socket.IO CONNECT ACK
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
const bidResponseLatency     = new Trend('bid_response_latency', true);
const bidTotalResponseTime   = new Trend('bid_total_response_time', true);
const rankSyncLatency        = new Trend('rank_sync_latency', true);
const bidToBroadcastLatency  = new Trend('bid_to_broadcast_latency', true);
const bidsSubmitted          = new Counter('bids_submitted');
const bidsAccepted           = new Counter('bids_accepted');
const bidsRejected           = new Counter('bids_rejected');
const auctionSuccessRate     = new Rate('auction_success_rate');
const businessErrors         = new Rate('business_errors');
const handshakeSuccess       = new Counter('handshake_success');
const handshakeError         = new Counter('handshake_error');

// ── Scenario selection ──────────────────────────────────────────────────────
const scenario = __ENV.K6_SCENARIO || 'quick';

function getOptions() {
  if (scenario === 'full') {
    return {
      scenarios: {
        full_bidding: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '1s',  target: 50 },
            { duration: '4m50s', target: 50 },
            { duration: '10s', target: 0 },
          ],
        },
      },
      thresholds: {
        bid_response_latency:    ['p(95)<5000', 'p(99)<10000'],
        rank_sync_latency:       ['p(95)<1500'],
        auction_success_rate:    ['rate>0'],
        business_errors:         ['rate<0.001'],
      },
    };
  }

  // Default "quick" — CI-friendly ramping
  return {
    scenarios: {
      quick_bidding: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '1s',  target: 20 },
          { duration: '20s', target: 20 },
          { duration: '5s',  target: 0 },
        ],
      },
    },
    thresholds: {
      bid_response_latency:    ['p(95)<5000', 'p(99)<10000'],
      rank_sync_latency:       ['p(95)<1500'],
      auction_success_rate:    ['rate>0'],
      business_errors:         ['rate<0.001'],
    },
  };
}

export const options = getOptions();

// ── Setup: register and login multiple users ────────────────────────────────
export function setup() {
  const apiBase = __ENV.API_BASE || 'http://localhost:3001';
  const userCount = Number(__ENV.USER_COUNT || 20);
  const tokens: string[] = [];

  for (let i = 0; i < userCount; i++) {
    const username = `k6_biduser_${i}_${Date.now()}`;
    const password = 'Test1234!';
    const nickname = `BidUser${i}`;

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
    const pendingBids: Record<string, { submitTime: number }> = {};
    const bidNewArrivals: Record<string, number> = {};

    // ── Message handler (registered before any sends) ──
    socket.on('message', (msg: string) => {
      const packet = parsePacket(msg);
      if (!packet) return;

      // Handle Engine.IO ping (server→client: "2", client→server: "3")
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
      if (packet.event === 'bid:accepted') {
        bidsAccepted.add(1);
        auctionSuccessRate.add(1);
        const key = packet.data?.idempotencyKey;
        if (key && pendingBids[key]) {
          const elapsed = Date.now() - pendingBids[key].submitTime;
          bidResponseLatency.add(elapsed);
          bidTotalResponseTime.add(elapsed);
          if (bidNewArrivals[key] !== undefined) {
            bidToBroadcastLatency.add(bidNewArrivals[key] - pendingBids[key].submitTime);
            delete bidNewArrivals[key];
          }
          delete pendingBids[key];
        }
      } else if (packet.event === 'bid:rejected') {
        bidsRejected.add(1);
        const key = packet.data?.idempotencyKey;
        const code = packet.data?.code;
        if (key && pendingBids[key]) {
          bidTotalResponseTime.add(Date.now() - pendingBids[key].submitTime);
          delete pendingBids[key];
        }
        if (typeof code === 'number' && code >= 50000) {
          businessErrors.add(1);
        }
        auctionSuccessRate.add(0);
      } else if (packet.event === 'rank:update') {
        const lastSubmitTime = Object.values(pendingBids).pop()?.submitTime;
        if (lastSubmitTime !== undefined) {
          rankSyncLatency.add(Date.now() - lastSubmitTime);
        }
      } else if (packet.event === 'bid:new') {
        const key = packet.data?.idempotencyKey;
        if (key) bidNewArrivals[key] = Date.now();
      }
    });

    // ── Socket open → start handshake ──
    socket.on('open', () => {
      hsState = performHandshake(socket, token);

      // Timeout: if handshake doesn't complete in 5s, close
      socket.setTimeout(() => {
        if (hsState !== 'connected') {
          handshakeError.add(1);
          socket.close();
        }
      }, 5000);
    });

    // ── Post-handshake business logic ──
    function onConnected() {
      emitEvent(socket, 'auction:join', { roomId });

      const bidCount = 5;
      for (let i = 0; i < bidCount; i++) {
        const key = uuidv4();
        const submitTime = Date.now();
        bidsSubmitted.add(1);
        pendingBids[key] = { submitTime };
        emitEvent(socket, 'bid:submit', { sessionId, idempotencyKey: key });
        sleep(0.5 + Math.random() * 0.5);
      }

      const holdDuration = scenario === 'full' ? 15000 : 10000;
      socket.setTimeout(() => socket.close(), holdDuration);
    }
  });

  sleep(0.3);
}

// ── handleSummary: output structured results ────────────────────────────────
export function handleSummary(data: Record<string, unknown>) {
  const metrics = data.metrics as Record<string, Record<string, unknown>> | undefined;

  const submitted  = (metrics?.bids_submitted?.values?.count as number) ?? 0;
  const accepted   = (metrics?.bids_accepted?.values?.count as number) ?? 0;
  const rejected   = (metrics?.bids_rejected?.values?.count as number) ?? 0;
  const successR   = (metrics?.auction_success_rate?.values?.rate as number) ?? 0;
  const bizRate    = (metrics?.business_errors?.values?.rate as number) ?? 0;

  const bidP50 = (metrics?.bid_response_latency?.values?.['p(50)'] as number) ?? 0;
  const bidP95 = (metrics?.bid_response_latency?.values?.['p(95)'] as number) ?? 0;
  const bidP99 = (metrics?.bid_response_latency?.values?.['p(99)'] as number) ?? 0;

  const totalP50 = (metrics?.bid_total_response_time?.values?.['p(50)'] as number) ?? 0;
  const totalP95 = (metrics?.bid_total_response_time?.values?.['p(95)'] as number) ?? 0;
  const totalP99 = (metrics?.bid_total_response_time?.values?.['p(99)'] as number) ?? 0;

  const rankP50 = (metrics?.rank_sync_latency?.values?.['p(50)'] as number) ?? 0;
  const rankP95 = (metrics?.rank_sync_latency?.values?.['p(95)'] as number) ?? 0;
  const rankP99 = (metrics?.rank_sync_latency?.values?.['p(99)'] as number) ?? 0;

  const bcastP50 = (metrics?.bid_to_broadcast_latency?.values?.['p(50)'] as number) ?? 0;
  const bcastP95 = (metrics?.bid_to_broadcast_latency?.values?.['p(95)'] as number) ?? 0;
  const bcastP99 = (metrics?.bid_to_broadcast_latency?.values?.['p(99)'] as number) ?? 0;

  const state = data.state as Record<string, unknown> | undefined;
  const testDuration = (state?.testRunDurationMs as number) ?? 1;
  const durationSeconds = testDuration / 1000;
  const throughput = durationSeconds > 0 ? accepted / durationSeconds : 0;
  const sessionId = Number(__ENV.SESSION_ID || 1);

  const summary = {
    timestamp: new Date().toISOString(),
    scenario: scenario === 'full' ? 'multi-user-bid-full' : 'multi-user-bid-quick',
    vus: scenario === 'full' ? 50 : 20,
    duration: scenario === 'full' ? '5m' : '30s',
    latency: {
      bid_response_ms: { p50: +bidP50.toFixed(2), p95: +bidP95.toFixed(2), p99: +bidP99.toFixed(2) },
      bid_total_response_ms: { p50: +totalP50.toFixed(2), p95: +totalP95.toFixed(2), p99: +totalP99.toFixed(2) },
      rank_sync_ms: { p50: +rankP50.toFixed(2), p95: +rankP95.toFixed(2), p99: +rankP99.toFixed(2) },
      bid_to_broadcast_ms: { p50: +bcastP50.toFixed(2), p95: +bcastP95.toFixed(2), p99: +bcastP99.toFixed(2) },
    },
    bidding: {
      submitted, accepted, rejected,
      throughput_per_second: +throughput.toFixed(2),
      success_rate_pct: +(successR * 100).toFixed(2),
      business_error_rate_pct: +(bizRate * 100).toFixed(4),
    },
    assertions: {
      bid_response_p95_lt_5000ms:  bidP95 < 5000,
      bid_response_p99_lt_10000ms: bidP99 < 10000,
      rank_sync_p95_lt_1500ms:     rankP95 < 1500,
      auction_success_rate_gt_0:   successR > 0,
      business_error_rate_lt_0_1:  bizRate < 0.001,
    },
  };

  const outputPath =
    __ENV.SUMMARY_OUTPUT || 'backend/tests/load/results/multi-user-bid-summary.json';

  return {
    stdout: JSON.stringify(summary, null, 2),
    [outputPath]: JSON.stringify(summary, null, 2),
  };
}
