/**
 * Artillery Socket.IO scenario processor
 *
 * Handles per-VU lifecycle:
 *   1. Register + login (HTTP) → get JWT token
 *   2. Socket.IO connect with auth
 *   3. Business events (join room, bid, etc.)
 */

const crypto = require('crypto');
const http = require('http');

// Shared agent with high connection limit for concurrent HTTP requests
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 500,
  maxFreeSockets: 100,
});

// Bid response time tracking
const bidTimers = new Map(); // idempotencyKey → startTime
const bidResponseTimes = []; // all response times in ms

// ── Helper: generate unique username ────────────────────────────────────────
function uniqueUsername(context, events, done) {
  const vuId = context.vars.__vu || crypto.randomUUID().slice(0, 8);
  context.vars.username = `artillery_${vuId}_${Date.now()}`;
  context.vars.password = 'Test1234!';
  context.vars.nickname = `ArtUser_${vuId}`;
  return done();
}

// ── Helper: HTTP POST using Node http module with shared agent ──────────────
function httpPost(target, path, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(target);
    const body = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      agent: httpAgent,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Helper: register + login via HTTP and capture token ──────────────────────
async function registerAndLogin(context, events, done) {
  const target = context.vars._target || 'http://localhost:3002';
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Register (ignore 409 conflict - user already exists)
      await httpPost(target, '/api/auth/register', {
        username: context.vars.username,
        password: context.vars.password,
        nickname: context.vars.nickname,
        role: 'user',
      });

      // Login
      const loginRes = await httpPost(target, '/api/auth/login', {
        username: context.vars.username,
        password: context.vars.password,
      });

      if (loginRes.status === 200) {
        const data = JSON.parse(loginRes.body);
        context.vars.token = data?.data?.accessToken;
        return done();
      }
    } catch (e) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
      }
    }
  }
  // All retries failed - continue without token (will fail at socket connect)
  return done();
}

// ── Helper: set socketio auth options ───────────────────────────────────────
function setSocketAuth(context, events, done) {
  return done();
}

// ── Helper: generate idempotency key and start bid timer ────────────────────
function generateIdempotencyKey(context, events, done) {
  context.vars.idempotencyKey = crypto.randomUUID();
  return done();
}

// ── Helper: submit bid via HTTP and measure response time ────────────────────
async function submitBidHttp(context, events, done) {
  const target = context.vars._target || 'http://localhost:3002';
  const token = context.vars.token;
  const idempotencyKey = context.vars.idempotencyKey || crypto.randomUUID();
  const sessionId = 1;

  const startTime = process.hrtime.bigint();
  try {
    const url = new URL(target);
    const body = JSON.stringify({ sessionId, idempotencyKey });
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: '/api/bid',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`,
      },
      agent: httpAgent,
    };

    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });

    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6; // ms
    const accepted = result.status === 200 || result.status === 201;
    bidResponseTimes.push({ elapsed, accepted, key: idempotencyKey });

    // Write to file
    try {
      const fs = require('fs');
      const path = require('path');
      const logLine = `${Date.now()},${elapsed.toFixed(2)},${accepted ? 'accepted' : 'rejected'},${result.status},${idempotencyKey}\n`;
      fs.appendFileSync(path.join(__dirname, 'reports', 'bid-metrics.csv'), logLine);
    } catch {}
  } catch (e) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    bidResponseTimes.push({ elapsed, accepted: false, key: idempotencyKey });
  }
  return done();
}

// ── Helper: log bid ack data for debugging ──────────────────────────────────
function logBidAck(context, events, done) {
  const ackData = context.vars.bidAck;
  try {
    const fs = require('fs');
    const path = require('path');
    const logLine = `ACK_DATA|${JSON.stringify(ackData)}|key=${context.vars.idempotencyKey}\n`;
    fs.appendFileSync(path.join(__dirname, 'reports', 'bid-metrics.csv'), logLine);
  } catch (e) {
    // ignore
  }
  return done();
}

// ── Helper: print bid metrics summary at end ────────────────────────────────
function printBidMetrics() {
  if (bidResponseTimes.length === 0) return;
  const times = bidResponseTimes.map(r => r.elapsed);
  const accepted = bidResponseTimes.filter(r => r.accepted);
  const rejected = bidResponseTimes.filter(r => !r.accepted);
  times.sort((a, b) => a - b);
  const p = (pct) => times[Math.floor(times.length * pct)];
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  try {
    const fs = require('fs');
    const path = require('path');
    const summary = [
      '=== BID RESPONSE TIME SUMMARY ===',
      `Total bids: ${times.length} | Accepted: ${accepted.length} | Rejected: ${rejected.length}`,
      `Min: ${times[0].toFixed(2)}ms | Max: ${times[times.length-1].toFixed(2)}ms | Avg: ${avg.toFixed(2)}ms`,
      `P50: ${p(0.5).toFixed(2)}ms | P90: ${p(0.9).toFixed(2)}ms | P95: ${p(0.95).toFixed(2)}ms | P99: ${p(0.99).toFixed(2)}ms`,
      '================================',
    ].join('\n');
    fs.appendFileSync(path.join(__dirname, 'reports', 'bid-metrics.csv'), `\n${summary}\n`);
  } catch {}
}

// Print on process exit
process.on('exit', printBidMetrics);

module.exports = {
  uniqueUsername,
  registerAndLogin,
  setSocketAuth,
  generateIdempotencyKey,
  submitBidHttp,
  logBidAck,
};
