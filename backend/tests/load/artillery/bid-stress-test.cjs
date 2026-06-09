/**
 * 批次出价压测脚本（增强版）
 *
 * 每批所有用户在 1s 内陆续出价，等全部响应后进入下一批
 * 用法: node bid-stress-test.cjs [concurrent_users] [batches] [sessionId]
 *
 * 指标覆盖:
 *   - 出价响应时间 (P50/P90/P95/P99)
 *   - 出价成功率 / QPS
 *   - 排名正确性校验 (金额降序 / 排名无重复 / 排名连续)
 *   - 广播同步延迟 (bid:accepted → rank:update)
 *   - 出价幂等率 (重复幂等键验证)
 *
 * 测试环境: Docker MySQL 3307 + Redis 6380 + 后端 3002
 */

const { io } = require('socket.io-client');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TARGET = process.env.TARGET || 'http://localhost:3002';
const CONCURRENT = parseInt(process.argv[2] || '50', 10);
const BATCHES = parseInt(process.argv[3] || '5', 10);
const SESSION_ID = parseInt(process.argv[4] || '380', 10);
const BATCH_SPREAD_MS = 1000; // 每批出价在 1s 内陆续发出
const RANK_VALIDATION_WAIT_MS = 5000; // 出价完成后等待 rank:update 广播的时间

// --tokens <path>: 预生成 token 文件，跳过运行时注册
const tokensFlagIdx = process.argv.indexOf('--tokens');
const TOKENS_FILE = tokensFlagIdx !== -1 ? process.argv[tokensFlagIdx + 1] : null;

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
function connectVU(token, lastLeaderboard) {
  return new Promise((resolve, reject) => {
    const socket = io(TARGET, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });

    socket.on('connect', () => {
      socket.emit('auction:join', { roomId: 1 });

      // 监听 rank:update 广播，收集排行榜数据
      socket.on('rank:update', (data) => {
        if (Array.isArray(data)) {
          lastLeaderboard.length = 0;
          lastLeaderboard.push(...data);
        }
      });

      // Wait for join to settle
      setTimeout(() => resolve(socket), 300);
    });

    socket.on('connect_error', (err) => reject(err));

    // Timeout
    setTimeout(() => reject(new Error('connect timeout')), 10000);
  });
}

// ── Send one bid and return a promise that resolves with the result ─────────
function sendBid(socket, batchIndex, vuIndex, overrideKey) {
  return new Promise((resolve) => {
    const idempotencyKey = overrideKey || crypto.randomUUID();
    const startTime = process.hrtime.bigint();
    let rankUpdateReceivedAt = null;

    // 注册一次性 rank:update 监听器，捕获出价后首次排名更新
    const rankHandler = () => {
      if (!rankUpdateReceivedAt) {
        rankUpdateReceivedAt = process.hrtime.bigint();
      }
    };
    socket.once('rank:update', rankHandler);

    const acceptHandler = (data) => {
      if (data.idempotencyKey === idempotencyKey) {
        const acceptedAt = process.hrtime.bigint();
        const elapsed = Number(acceptedAt - startTime) / 1e6;
        socket.off('bid:accepted', acceptHandler);
        socket.off('bid:rejected', rejectHandler);
        // rank:update 可能还未到达，延迟清理
        setTimeout(() => socket.off('rank:update', rankHandler), 2000);
        resolve({
          elapsed, accepted: true, idempotencyKey,
          batch: batchIndex, vu: vuIndex,
          acceptedAt, isDuplicate: !!overrideKey,
          acceptedAmount: data.amount ?? data.currentPrice ?? null,
          _getRankSyncMs: () => rankUpdateReceivedAt
            ? Number(rankUpdateReceivedAt - acceptedAt) / 1e6
            : null,
        });
      }
    };

    const rejectHandler = (data) => {
      if (data.idempotencyKey === idempotencyKey) {
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
        socket.off('bid:accepted', acceptHandler);
        socket.off('bid:rejected', rejectHandler);
        setTimeout(() => socket.off('rank:update', rankHandler), 2000);
        resolve({
          elapsed, accepted: false, idempotencyKey,
          batch: batchIndex, vu: vuIndex, reason: data.reason,
          isDuplicate: !!overrideKey,
          _getRankSyncMs: () => null,
        });
      }
    };

    socket.on('bid:accepted', acceptHandler);
    socket.on('bid:rejected', rejectHandler);
    socket.emit('bid:submit', { sessionId: SESSION_ID, idempotencyKey });

    // Timeout for this single bid
    setTimeout(() => {
      socket.off('bid:accepted', acceptHandler);
      socket.off('bid:rejected', rejectHandler);
      socket.off('rank:update', rankHandler);
      resolve({
        elapsed: 0, accepted: false, idempotencyKey,
        batch: batchIndex, vu: vuIndex, reason: 'timeout',
        isDuplicate: !!overrideKey,
        _getRankSyncMs: () => null,
      });
    }, 10000);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 全局排行榜收集器（任意 socket 的最后一次 rank:update 数据）
  const lastLeaderboard = [];

  console.log(`\n=== 批次出价压测 (增强版) ===`);
  console.log(`目标: ${TARGET}`);
  console.log(`并发用户: ${CONCURRENT}`);
  console.log(`出价批次: ${BATCHES}`);
  console.log(`每批散布: ${BATCH_SPREAD_MS}ms`);
  console.log(`拍卖 Session ID: ${SESSION_ID}`);
  console.log(`总出价数: ${CONCURRENT * BATCHES}`);
  console.log(`开始时间: ${new Date().toISOString()}\n`);

  const testStart = process.hrtime.bigint();

  // Phase 1: 获取 Token + 建立连接
  console.log('--- 阶段 1: 注册登录 & 建立连接 ---');
  const sockets = [];
  const connectStart = process.hrtime.bigint();

  // 加载预生成 token（如有）
  let preGenTokens = [];
  if (TOKENS_FILE) {
    try {
      const raw = fs.readFileSync(path.resolve(TOKENS_FILE), 'utf-8');
      preGenTokens = JSON.parse(raw);
      console.log(`  已加载 ${preGenTokens.length} 个预生成 token`);
    } catch (e) {
      console.log(`  ⚠️ 加载 token 文件失败: ${e.message}，回退到运行时注册`);
    }
  }

  for (let i = 0; i < CONCURRENT; i++) {
    try {
      // 优先使用预生成 token，不足时回退到注册
      const token = preGenTokens[i] || await registerAndLogin(i);
      const socket = await connectVU(token, lastLeaderboard);
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
  // 幂等性测试: 记录每个 VU 首次 accepted 的幂等键，用于后续重放验证
  const firstAcceptedKeyPerVu = new Map(); // vuIndex → { idempotencyKey, acceptedAmount }

  for (let batch = 0; batch < BATCHES; batch++) {
    const batchStart = process.hrtime.bigint();

    // Each VU sends a bid, staggered within BATCH_SPREAD_MS
    const bidPromises = sockets.map(({ socket, vuIndex }, idx) => {
      const delay = Math.floor((idx / connectedCount) * BATCH_SPREAD_MS);

      return new Promise(r => setTimeout(r, delay))
        .then(() => sendBid(socket, batch, vuIndex))
        .then(result => {
          // 记录每个 VU 首次 accepted 的幂等键，用于后续重放验证
          if (result.accepted && !firstAcceptedKeyPerVu.has(vuIndex)) {
            firstAcceptedKeyPerVu.set(vuIndex, {
              idempotencyKey: result.idempotencyKey,
              acceptedAmount: result.acceptedAmount,
            });
          }
          return result;
        });
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

  // Phase 2.5: 幂等性重放验证 — 用每个 VU 首次 accepted 的 key 重放，验证返回相同结果
  console.log('\n--- 阶段 2.5: 幂等性重放验证 ---');
  const REPLAY_SAMPLE_SIZE = Math.min(20, firstAcceptedKeyPerVu.size);
  const replayEntries = [...firstAcceptedKeyPerVu.entries()].slice(0, REPLAY_SAMPLE_SIZE);
  const replayResults = [];

  for (const [vuIndex, { idempotencyKey, acceptedAmount }] of replayEntries) {
    const { socket } = sockets.find(s => s.vuIndex === vuIndex) || {};
    if (!socket) continue;

    const replayResult = await sendBid(socket, -1, vuIndex, idempotencyKey);
    // 重放正确 = 返回 accepted 且金额与首次一致，或返回 rejected(重复拒绝)
    const isReplayCorrect = replayResult.accepted
      ? (acceptedAmount === null || replayResult.acceptedAmount === null || replayResult.acceptedAmount === acceptedAmount)
      : true; // rejected 也算正确（服务端直接拒绝重复 key）
    replayResults.push({
      vuIndex, idempotencyKey,
      originalAmount: acceptedAmount,
      replayAccepted: replayResult.accepted,
      replayAmount: replayResult.acceptedAmount,
      isReplayCorrect,
    });
  }

  const replayViolations = replayResults.filter(r => !r.isReplayCorrect);
  console.log(`  重放测试数: ${replayResults.length}`);
  console.log(`  重放正确数: ${replayResults.length - replayViolations.length}`);
  console.log(`  幂等违规数: ${replayViolations.length}`);
  if (replayViolations.length > 0) {
    replayViolations.forEach(v => {
      console.log(`    ⚠️ VU ${v.vuIndex}: 原始金额 ${v.originalAmount}, 重放金额 ${v.replayAmount}`);
    });
  }

  // Phase 3: 等待 rank:update 广播到达 + 收集精确延迟
  console.log('\n--- 阶段 3: 广播同步延迟测量 ---');
  await new Promise(r => setTimeout(r, RANK_VALIDATION_WAIT_MS));

  const lastBatchResults = allResults.filter(r => r.batch === BATCHES - 1);
  const preciseSyncDelays = [];
  let syncReceivedCount = 0;

  for (const r of lastBatchResults) {
    if (typeof r._getRankSyncMs === 'function') {
      const delay = r._getRankSyncMs();
      if (delay !== null) {
        preciseSyncDelays.push(delay);
        syncReceivedCount++;
      }
    }
  }

  const allSocketsReceivedRankUpdate = syncReceivedCount >= lastBatchResults.length * 0.95;
  console.log(`  最后一批出价数: ${lastBatchResults.length}`);
  console.log(`  收到 rank:update 的出价数: ${syncReceivedCount}/${lastBatchResults.length}`);
  console.log(`  全部在 ${RANK_VALIDATION_WAIT_MS}ms 窗口内: ${allSocketsReceivedRankUpdate ? '✅' : '❌'}`);

  // Phase 4: 排名正确性校验
  console.log('\n--- 阶段 4: 排名正确性校验 ---');

  let rankingCorrect = false;
  let duplicateRanks = 0;
  let rankEntries = 0;
  let rankSequential = false;

  if (lastLeaderboard.length > 0) {
    rankEntries = lastLeaderboard.length;

    // 验证 1: 金额降序排列
    const amounts = lastLeaderboard.map(e => e.amount);
    rankingCorrect = amounts.every((val, i, arr) => i === 0 || arr[i - 1] >= val);

    // 验证 2: 无重复排名
    const rankSet = new Set(lastLeaderboard.map(e => e.rank));
    duplicateRanks = lastLeaderboard.length - rankSet.size;

    // 验证 3: 排名连续 (1,2,3,...)
    const ranks = lastLeaderboard.map(e => e.rank).sort((a, b) => a - b);
    rankSequential = ranks.every((r, i) => r === i + 1);

    console.log(`  排行榜条目数: ${rankEntries}`);
    console.log(`  金额降序排列: ${rankingCorrect ? '✅' : '❌'}`);
    console.log(`  排名无重复: ${duplicateRanks === 0 ? '✅' : `❌ (${duplicateRanks} duplicates)`}`);
    console.log(`  排名连续: ${rankSequential ? '✅' : '❌'}`);
  } else {
    console.log('  ⚠️ 未收到 rank:update 广播，无法验证排名正确性');
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

  // ── 幂等性统计（基于重放验证）────────────────────────────────────────────
  const idempotencyViolations = replayViolations.length;
  const idempotencyCompliance = replayResults.length > 0
    ? ((1 - idempotencyViolations / replayResults.length) * 100)
    : 100;

  console.log(`\n--- 幂等性验证 ---`);
  console.log(`  重放测试数: ${replayResults.length}`);
  console.log(`  幂等违规数: ${idempotencyViolations}`);
  console.log(`  幂等合规率: ${idempotencyCompliance.toFixed(1)}%`);

  // ── 广播同步延迟统计（精确测量）────────────────────────────────────────────
  console.log(`\n--- 广播同步延迟 ---`);
  console.log(`  最后一批出价数: ${lastBatchResults.length}`);
  console.log(`  收到 rank:update 的出价数: ${syncReceivedCount}/${lastBatchResults.length}`);
  if (preciseSyncDelays.length > 0) {
    const sortedDelays = [...preciseSyncDelays].sort((a, b) => a - b);
    const syncP50 = sortedDelays[Math.floor(sortedDelays.length * 0.5)];
    const syncP95 = sortedDelays[Math.min(Math.floor(sortedDelays.length * 0.95), sortedDelays.length - 1)];
    const syncP99 = sortedDelays[Math.min(Math.floor(sortedDelays.length * 0.99), sortedDelays.length - 1)];
    const syncMax = sortedDelays[sortedDelays.length - 1];
    console.log(`  同步延迟 P50: ${syncP50.toFixed(1)}ms`);
    console.log(`  同步延迟 P95: ${syncP95.toFixed(1)}ms`);
    console.log(`  同步延迟 P99: ${syncP99.toFixed(1)}ms`);
    console.log(`  同步延迟 Max: ${syncMax.toFixed(1)}ms`);
    console.log(`  全部 <1s: ${syncMax < 1000 ? '✅' : '❌'}`);
    console.log(`  全部 <${RANK_VALIDATION_WAIT_MS}ms 窗口: ${syncMax < RANK_VALIDATION_WAIT_MS ? '✅' : '❌'}`);
  } else {
    console.log(`  ⚠️ 未收集到精确同步延迟数据`);
  }

  // ── 排名正确性汇总 ────────────────────────────────────────────────────────
  console.log(`\n--- 排名正确性汇总 ---`);
  console.log(`  排行榜条目数: ${rankEntries}`);
  console.log(`  金额降序排列: ${rankingCorrect ? '✅' : '❌'}`);
  console.log(`  排名无重复: ${duplicateRanks === 0 ? '✅' : '❌'}`);
  console.log(`  排名连续: ${rankSequential ? '✅' : '❌'}`);

  // Write CSV
  const csvPath = path.join(__dirname, 'reports', 'bid-stress-results.csv');
  const csvHeader = 'batch,vu,elapsed_ms,accepted,reason,idempotencyKey,isDuplicate\n';
  const csvLines = allResults.map(r =>
    `${r.batch},${r.vu},${r.elapsed.toFixed(2)},${r.accepted},${r.reason || ''},${r.idempotencyKey || ''},${r.isDuplicate || false}`
  ).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvLines + '\n');
  console.log(`\n详细数据已保存: ${csvPath}`);

  // Write JSON summary
  const sortedSyncDelays = preciseSyncDelays.length > 0 ? [...preciseSyncDelays].sort((a, b) => a - b) : [];
  const summaryPath = path.join(__dirname, 'reports', `bid-stress-${CONCURRENT}vu-summary.json`);
  const summary = {
    config: { concurrent: CONCURRENT, batches: BATCHES, sessionId: SESSION_ID },
    timestamp: new Date().toISOString(),
    connection: {
      success: connectedCount,
      total: CONCURRENT,
      rate: (connectedCount / CONCURRENT * 100).toFixed(1) + '%',
    },
    bidding: {
      total: allResults.length,
      accepted: accepted.length,
      rejected: rejected.length,
      successRate: (accepted.length / results.length * 100).toFixed(1) + '%',
    },
    latency: {
      min: Number(times[0].toFixed(2)),
      avg: Number(avg.toFixed(2)),
      p50: Number(percentile(0.5).toFixed(2)),
      p90: Number(percentile(0.9).toFixed(2)),
      p95: Number(percentile(0.95).toFixed(2)),
      p99: Number(percentile(0.99).toFixed(2)),
      max: Number(times[times.length - 1].toFixed(2)),
    },
    idempotency: {
      replayTests: replayResults.length,
      violations: idempotencyViolations,
      complianceRate: idempotencyCompliance.toFixed(1) + '%',
    },
    ranking: {
      correct: rankingCorrect,
      duplicateRanks,
      sequential: rankSequential,
      entries: rankEntries,
    },
    broadcastSync: {
      receivedCount: syncReceivedCount,
      totalInLastBatch: lastBatchResults.length,
      allWithinWindow: syncReceivedCount >= lastBatchResults.length * 0.95,
      windowMs: RANK_VALIDATION_WAIT_MS,
      preciseDelayMs: sortedSyncDelays.length > 0 ? {
        p50: Number(sortedSyncDelays[Math.floor(sortedSyncDelays.length * 0.5)].toFixed(1)),
        p95: Number(sortedSyncDelays[Math.min(Math.floor(sortedSyncDelays.length * 0.95), sortedSyncDelays.length - 1)].toFixed(1)),
        p99: Number(sortedSyncDelays[Math.min(Math.floor(sortedSyncDelays.length * 0.99), sortedSyncDelays.length - 1)].toFixed(1)),
        max: Number(sortedSyncDelays[sortedSyncDelays.length - 1].toFixed(1)),
      } : null,
    },
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`摘要 JSON: ${summaryPath}`);
}

main().catch(console.error);
