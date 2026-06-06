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
 *   API_BASE   - API base URL (default http://localhost:3002)
 *   WS_URL     - WebSocket URL (default ws://localhost:3002)
 *   ROOM_ID    - Room ID
 *   SESSION_ID - Auction session ID
 *   K6_SCENARIO - quick or full
 *   USER_COUNT  - Number of users to register (default 20)
 */

import ws from 'k6/ws';
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

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

// ── UUID v4 (local implementation to avoid network dependency) ────────────────
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
  const apiBase = __ENV.API_BASE || 'http://localhost:3002';
  const userCount = Number(__ENV.USER_COUNT || 20);
  const tokens: string[] = [];

  for (let i = 0; i < userCount; i++) {
    const username = `k6_biduser_${i}_${Date.now()}`;
    const password = 'Test1234!';
    const nickname = `BidUser${i}`;

    // Register
    const regRes = http.post(
      `${apiBase}/api/auth/register`,
      JSON.stringify({ username, password, nickname, role: 'user' }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    // Login (even if register fails due to duplicate, login should work)
    const loginRes = http.post(
      `${apiBase}/api/auth/login`,
      JSON.stringify({ username, password }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body as string);
        const token = body.data?.accessToken;
        if (token) {
          tokens.push(token);
        }
      } catch {
        // Skip this user on parse failure
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
  const baseUrl = __ENV.WS_URL || 'ws://localhost:3002';
  const roomId = Number(__ENV.ROOM_ID || 1);
  const sessionId = Number(__ENV.SESSION_ID || 1);
  const url = `${baseUrl}/socket.io/?EIO=4&transport=websocket&token=${encodeURIComponent(token)}`;

  ws.connect(url, null, (socket) => {
    // Track pending bids by idempotencyKey for latency measurement
    const pendingBids: Record<string, { submitTime: number }> = {};
    // Track bid:new arrival times for broadcast latency calculation
    const bidNewArrivals: Record<string, number> = {};

    socket.on('open', () => {
      // Send Socket.IO CONNECT with auth token to complete the handshake
      socket.send('40{"token":"' + token + '"}');

      emitSocketIO(socket, 'auction:join', { roomId });

      // Single message handler for all Socket.IO events
      socket.on('message', (msg: string) => {
        const parsed = parseSocketIOMessage(msg);
        if (!parsed) return;

        if (parsed.event === 'bid:accepted') {
          bidsAccepted.add(1);
          auctionSuccessRate.add(1);

          const key = parsed.data?.idempotencyKey;
          if (key && pendingBids[key] !== undefined) {
            const now = Date.now();
            const elapsed = now - pendingBids[key].submitTime;
            bidResponseLatency.add(elapsed);
            bidTotalResponseTime.add(elapsed);

            // If bid:new already arrived, compute broadcast latency
            if (bidNewArrivals[key] !== undefined) {
              bidToBroadcastLatency.add(bidNewArrivals[key] - pendingBids[key].submitTime);
              delete bidNewArrivals[key];
            }

            delete pendingBids[key];
          }
        } else if (parsed.event === 'bid:rejected') {
          bidsRejected.add(1);

          const key = parsed.data?.idempotencyKey;
          const code = parsed.data?.code;

          // Total response time includes rejected requests (industry standard)
          if (key && pendingBids[key] !== undefined) {
            bidTotalResponseTime.add(Date.now() - pendingBids[key].submitTime);
            delete pendingBids[key];
          }

          // Distinguish business rejection from non-business errors
          // Codes: 40901=idempotency/lock, 42900=rate limit, 40900=ended, 40400=not found
          // Only 50000+ are non-business (system) errors
          if (typeof code === 'number' && code >= 50000) {
            // Non-business error (system error)
            businessErrors.add(1);
          }
          auctionSuccessRate.add(0);
        } else if (parsed.event === 'rank:update') {
          // Compute rank sync latency — time from last bid submission to rank update
          const lastSubmitTime = Object.values(pendingBids).pop()?.submitTime;
          if (lastSubmitTime !== undefined) {
            rankSyncLatency.add(Date.now() - lastSubmitTime);
          }
        } else if (parsed.event === 'bid:new') {
          // Record bid:new arrival time for broadcast latency calculation
          const key = parsed.data?.idempotencyKey;
          if (key) {
            bidNewArrivals[key] = Date.now();
          }
        }
      });

      // Each VU submits 5 bids with 0.5-1s intervals
      const bidCount = 5;
      for (let i = 0; i < bidCount; i++) {
        const key = uuidv4();
        const submitTime = Date.now();

        bidsSubmitted.add(1);
        pendingBids[key] = { submitTime };
        emitSocketIO(socket, 'bid:submit', {
          sessionId,
          idempotencyKey: key,
        });

        sleep(0.5 + Math.random() * 0.5);
      }

      const holdDuration = scenario === 'full' ? 15000 : 10000;
      socket.setTimeout(() => socket.close(), holdDuration);
    });
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

  // Calculate throughput
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
      bid_response_ms: {
        p50: Number(bidP50.toFixed(2)),
        p95: Number(bidP95.toFixed(2)),
        p99: Number(bidP99.toFixed(2)),
      },
      bid_total_response_ms: {
        p50: Number(totalP50.toFixed(2)),
        p95: Number(totalP95.toFixed(2)),
        p99: Number(totalP99.toFixed(2)),
        note: 'Includes both accepted and rejected bids (industry standard response time)',
      },
      rank_sync_ms: {
        p50: Number(rankP50.toFixed(2)),
        p95: Number(rankP95.toFixed(2)),
        p99: Number(rankP99.toFixed(2)),
      },
      bid_to_broadcast_ms: {
        p50: Number(bcastP50.toFixed(2)),
        p95: Number(bcastP95.toFixed(2)),
        p99: Number(bcastP99.toFixed(2)),
      },
    },
    bidding: {
      submitted,
      accepted,
      rejected,
      throughput_per_second: Number(throughput.toFixed(2)),
      success_rate_pct: Number((successR * 100).toFixed(2)),
      business_error_rate_pct: Number((bizRate * 100).toFixed(4)),
    },
    consistency_check: {
      session_id: sessionId,
      note:
        'Run consistency-checker separately: ' +
        'npx tsx backend/scripts/check-consistency.ts --session-id=' + sessionId,
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
