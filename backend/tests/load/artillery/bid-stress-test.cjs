/**
 * 批次出价压测脚本
 *
 * 每批所有用户在 1s 内陆续出价，等全部响应后进入下一批
 * 用法: node bid-stress-test.cjs [concurrent_users] [batches] [sessionId]
 *
 * 测试环境: Docker MySQL 3307 + Redis 6380 + 后端 3002
 */

const { io } = require('socket.io-client');
const http = require('http');
const crypto = require('crypto');

const TARGET = process.env.TARGET || 'http://localhost:3002';
const CONCURRENT = parseInt(process.argv[2] || '50', 10);
const BATCHES = parseInt(process.argv[3] || '5', 10);
const SESSION_ID = parseInt(process.argv[4] || '380', 10);
const BATCH_SPREAD_MS = 1000; // 每批出价在 1s 内陆续发出

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 500 });

// ── HTTP helper ──────────────────────────────────────────────────────────────
function httpPost(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(TARGET);
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: url.hostname, port: url.port || 80, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
      agent: httpAgent,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Register + Login ────────────────────────────────────────────────────────
async function registerAndLogin(vuId) {
  const username = `stress_${vuId}_${Date.now()}`;
  const password = 'Test1234!';
  const nickname = `Stress_${vuId}`;

  try { await httpPost('/api/auth/register', { username, password, nickname, role: 'user' }); } catch {}
  const res = await httpPost('/api/auth/login', { username, password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
  return JSON.parse(res.body).data.accessToken;
}

// ── Connect a single VU and return the socket ───────────────────────────────
function connectVU(token) {
  return new Promise((resolve, reject) => {
    const socket = io(TARGET, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });

    socket.on('connect', () => {
      socket.emit('auction:join', { roomId: 1 });
      // Wait for join to settle
      setTimeout(() => resolve(socket), 300);
    });

    socket.on('connect_error', (err) => reject(err));

    // Timeout
    setTimeout(() => reject(new Error('connect timeout')), 10000);
  });
}

// ── Send one bid and return a promise that resolves with the result ─────────
function sendBid(socket, batchIndex, vuIndex) {
  return new Promise((resolve) => {
    const idempotencyKey = crypto.randomUUID();
    const startTime = process.hrtime.bigint();

    const acceptHandler = (data) => {
      if (data.idempotencyKey === idempotencyKey) {
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
        socket.off('bid:accepted', acceptHandler);
        socket.off('bid:rejected', rejectHandler);
        resolve({ elapsed, accepted: true, idempotencyKey, batch: batchIndex, vu: vuIndex });
      }
    };

    const rejectHandler = (data) => {
      if (data.idempotencyKey === idempotencyKey) {
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
        socket.off('bid:accepted', acceptHandler);
        socket.off('bid:rejected', rejectHandler);
        resolve({ elapsed, accepted: false, idempotencyKey, batch: batchIndex, vu: vuIndex, reason: data.reason });
      }
    };

    socket.on('bid:accepted', acceptHandler);
    socket.on('bid:rejected', rejectHandler);
    socket.emit('bid:submit', { sessionId: SESSION_ID, idempotencyKey });

    // Timeout for this single bid
    setTimeout(() => {
      socket.off('bid:accepted', acceptHandler);
      socket.off('bid:rejected', rejectHandler);
      resolve({ elapsed: 0, accepted: false, idempotencyKey, batch: batchIndex, vu: vuIndex, reason: 'timeout' });
    }, 10000);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== 批次出价压测 ===`);
  console.log(`目标: ${TARGET}`);
  console.log(`并发用户: ${CONCURRENT}`);
  console.log(`出价批次: ${BATCHES}`);
  console.log(`每批散布: ${BATCH_SPREAD_MS}ms`);
  console.log(`拍卖 Session ID: ${SESSION_ID}`);
  console.log(`总出价数: ${CONCURRENT * BATCHES}`);
  console.log(`开始时间: ${new Date().toISOString()}\n`);

  const testStart = process.hrtime.bigint();

  // Phase 1: Register + Login + Connect all VUs
  console.log('--- 阶段 1: 注册登录 & 建立连接 ---');
  const sockets = [];
  const connectStart = process.hrtime.bigint();

  for (let i = 0; i < CONCURRENT; i++) {
    try {
      const token = await registerAndLogin(i);
      const socket = await connectVU(token);
      sockets.push({ socket, vuIndex: i });
    } catch (e) {
      console.log(`  VU ${i} 连接失败: ${e.message}`);
    }
    // Stagger connections slightly to avoid thundering herd
    if (i % 20 === 19) await new Promise(r => setTimeout(r, 100));
  }

  const connectedCount = sockets.length;
  const connectDuration = Number(process.hrtime.bigint() - connectStart) / 1e3;
  console.log(`  成功连接: ${connectedCount}/${CONCURRENT} (${connectDuration.toFixed(1)}ms)`);

  if (connectedCount === 0) {
    console.log('没有成功连接，退出');
    return;
  }

  // Phase 2: Batch bidding
  console.log('\n--- 阶段 2: 批次出价 ---');
  const allResults = [];

  for (let batch = 0; batch < BATCHES; batch++) {
    const batchStart = process.hrtime.bigint();

    // Each VU sends a bid, staggered within BATCH_SPREAD_MS
    const bidPromises = sockets.map(({ socket, vuIndex }, idx) => {
      // Spread bids evenly across BATCH_SPREAD_MS
      const delay = Math.floor((idx / connectedCount) * BATCH_SPREAD_MS);
      return new Promise(r => setTimeout(r, delay)).then(() => sendBid(socket, batch, vuIndex));
    });

    const batchResults = await Promise.all(bidPromises);
    allResults.push(...batchResults);

    const batchDuration = Number(process.hrtime.bigint() - batchStart) / 1e6;
    const batchAccepted = batchResults.filter(r => r.accepted).length;
    const batchRejected = batchResults.filter(r => !r.accepted).length;
    console.log(`  批次 ${batch + 1}/${BATCHES}: ${batchAccepted} 成功 / ${batchRejected} 失败 / 耗时 ${batchDuration.toFixed(0)}ms`);

    // Brief pause between batches (1s)
    if (batch < BATCHES - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Disconnect all
  sockets.forEach(({ socket }) => socket.disconnect());

  const testDuration = Number(process.hrtime.bigint() - testStart) / 1e9;

  // ── Statistics ─────────────────────────────────────────────────────────────
  const results = allResults.filter(r => r.elapsed > 0);
  const accepted = results.filter(r => r.accepted);
  const rejected = results.filter(r => !r.accepted);
  const times = results.map(r => r.elapsed).sort((a, b) => a - b);

  if (times.length === 0) {
    console.log('No valid bid response times recorded.');
    return;
  }

  const percentile = (pct) => times[Math.min(Math.floor(times.length * pct), times.length - 1)];
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  // QPS based on actual bidding phase only (exclude connect/disconnect)
  const biddingDuration = times.length > 0 ? (times[times.length - 1] - times[0]) / 1000 : 0;
  const qps = biddingDuration > 0 ? results.length / biddingDuration : 0;

  console.log(`\n=== 批次出价压测结果 ===`);
  console.log(`测试总时长: ${testDuration.toFixed(1)}s`);
  console.log(`总出价数: ${allResults.length} (有效计时: ${results.length})`);
  console.log(`出价成功: ${accepted.length} (${(accepted.length / results.length * 100).toFixed(1)}%)`);
  console.log(`出价失败: ${rejected.length} (${(rejected.length / results.length * 100).toFixed(1)}%)`);
  console.log(`\n--- 响应时间 (ms) ---`);
  console.log(`  Min:  ${times[0].toFixed(2)}`);
  console.log(`  Avg:  ${avg.toFixed(2)}`);
  console.log(`  P50:  ${percentile(0.5).toFixed(2)}`);
  console.log(`  P90:  ${percentile(0.9).toFixed(2)}`);
  console.log(`  P95:  ${percentile(0.95).toFixed(2)}`);
  console.log(`  P99:  ${percentile(0.99).toFixed(2)}`);
  console.log(`  Max:  ${times[times.length - 1].toFixed(2)}`);

  // Per-batch stats
  console.log(`\n--- 每批响应时间 (ms) ---`);
  for (let batch = 0; batch < BATCHES; batch++) {
    const batchTimes = results.filter(r => r.batch === batch).map(r => r.elapsed).sort((a, b) => a - b);
    if (batchTimes.length === 0) continue;
    const bAvg = batchTimes.reduce((s, t) => s + t, 0) / batchTimes.length;
    const bP50 = batchTimes[Math.floor(batchTimes.length * 0.5)];
    const bP95 = batchTimes[Math.min(Math.floor(batchTimes.length * 0.95), batchTimes.length - 1)];
    const bAccepted = results.filter(r => r.batch === batch && r.accepted).length;
    console.log(`  批次 ${batch + 1}: 成功 ${bAccepted}/${batchTimes.length} | Avg ${bAvg.toFixed(1)} | P50 ${bP50.toFixed(1)} | P95 ${bP95.toFixed(1)}`);
  }

  console.log(`\n--- 吞吐量 ---`);
  console.log(`  每批出价数: ${connectedCount}`);
  console.log(`  批次间隔: 1s`);
  console.log(`  并发连接数: ${connectedCount}`);

  // Rejection reasons
  if (rejected.length > 0) {
    const reasons = {};
    rejected.forEach(r => {
      const reason = r.reason || 'unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    console.log(`\n--- 失败原因 ---`);
    Object.entries(reasons).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count} (${(count / rejected.length * 100).toFixed(1)}%)`);
    });
  }

  // Write CSV
  const fs = require('fs');
  const path = require('path');
  const csvPath = path.join(__dirname, 'reports', 'bid-stress-results.csv');
  const csvHeader = 'batch,vu,elapsed_ms,accepted,reason,idempotencyKey\n';
  const csvLines = allResults.map(r =>
    `${r.batch},${r.vu},${r.elapsed.toFixed(2)},${r.accepted},${r.reason || ''},${r.idempotencyKey || ''}`
  ).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvLines + '\n');
  console.log(`\n详细数据已保存: ${csvPath}`);
}

main().catch(console.error);
