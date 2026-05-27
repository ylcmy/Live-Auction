/**
 * 临时脚本：生成大量模拟数据用于压力测试
 * 用法: npx tsx scripts/generate-mock-data.ts [数量倍数，默认1]
 * 示例: npx tsx scripts/generate-mock-data.ts 10  → 生成10倍数据
 *
 * 默认基准量（可通过命令行参数乘以倍数）:
 *   - 50 商家, 2000 普通用户
 *   - 500 商品, 500 竞拍规则
 *   - 50 直播间
 *   - 200 竞拍场次 (含 pending/active/ended 混合)
 *   - 50000 出价记录
 *   - 100 订单
 */

import { db } from '../src/infrastructure/db/knex.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// ============================================================
// 可调参数
// ============================================================
const MULTIPLIER = Math.max(1, parseInt(process.argv[2] || '1', 10));

const MERCHANT_COUNT = 50 * MULTIPLIER;
const USER_COUNT = 2000 * MULTIPLIER;
const PRODUCT_COUNT = 500 * MULTIPLIER;
const ROOM_COUNT = 50 * MULTIPLIER;
const SESSION_COUNT = 200 * MULTIPLIER;
const BID_COUNT = 50000 * MULTIPLIER;
const ORDER_COUNT = 100 * MULTIPLIER;

const BATCH_SIZE = 1000;


// ============================================================
// 工具函数
// ============================================================

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomTimestamp(daysBack: number): Date {
  return new Date(Date.now() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
}

async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const result = await db(table).insert(chunk);
    // MySQL 批量插入只返回第一个自增 ID，需要手动展开
    const firstId = Array.isArray(result) ? (result[0] as number) : (result as number);
    for (let j = 0; j < chunk.length; j++) {
      ids.push(firstId + j);
    }
    console.log(`  [${table}] 已插入 ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  return ids;
}

// ============================================================
// 数据生成
// ============================================================

async function generateUsers(): Promise<{ merchantIds: number[]; userIds: number[] }> {
  console.log(`\n生成用户 (${MERCHANT_COUNT} 商家 + ${USER_COUNT} 普通用户)...`);
  const hash = await bcrypt.hash('pass1234', 10);

  const merchants: Record<string, unknown>[] = [];
  for (let i = 1; i <= MERCHANT_COUNT; i++) {
    merchants.push({
      username: `merchant_${i}`,
      password_hash: hash,
      role: 'merchant',
      nickname: `商家${String(i).padStart(3, '0')}`,
      avatar_url: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const users: Record<string, unknown>[] = [];
  for (let i = 1; i <= USER_COUNT; i++) {
    users.push({
      username: `user_${i}`,
      password_hash: hash,
      role: 'user',
      nickname: `竞拍用户${String(i).padStart(4, '0')}`,
      avatar_url: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const merchantIds = await batchInsert('users', merchants);
  const userIds = await batchInsert('users', users);
  return { merchantIds, userIds };
}

async function generateProducts(merchantIds: number[]): Promise<number[]> {
  console.log(`\n生成商品 (${PRODUCT_COUNT})...`);
  const categories = ['数码', '美妆', '服饰', '家电', '食品', '图书', '玩具', '珠宝', '运动', '家居'];

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    rows.push({
      merchant_id: randomItem(merchantIds),
      name: `商品${i} - ${randomItem(['限量', '新款', '热销', '经典', '爆款'])}${randomItem(categories)}`,
      description: `这是商品${i}的详细描述`,
      image_url: `https://picsum.photos/400/400?random=${i}`,
      category: randomItem(categories),
      status: randomItem(['draft', 'pending', 'active', 'ended', 'ended', 'ended', 'unsold']),
      created_at: randomTimestamp(90),
      updated_at: new Date(),
    });
  }

  return batchInsert('products', rows);
}

async function generateAuctionRules(productIds: number[]): Promise<number[]> {
  console.log(`\n生成竞拍规则 (${PRODUCT_COUNT})...`);

  const rows: Record<string, unknown>[] = [];
  for (const pid of productIds) {
    rows.push({
      product_id: pid,
      start_price: 0.0,
      bid_increment: randomItem([5, 10, 20, 50, 100]),
      ceiling_price: Math.random() > 0.3 ? randomPrice(200, 2000) : null,
      duration_seconds: randomItem([60, 120, 180, 300]),
      extend_seconds: 20,
      max_extensions: randomItem([5, 10, 15]),
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  return batchInsert('auction_rules', rows);
}

async function generateLiveRooms(merchantIds: number[]): Promise<number[]> {
  console.log(`\n生成直播间 (${ROOM_COUNT})...`);

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= ROOM_COUNT; i++) {
    rows.push({
      host_id: randomItem(merchantIds),
      title: `直播间${i} - ${randomItem(['限时抢购', '秒杀专场', '新品首发', '品牌特卖', '捡漏专区'])}`,
      status: randomItem(['offline', 'live', 'live', 'live']),
      stream_url: null,
      created_at: randomTimestamp(30),
    });
  }

  return batchInsert('live_rooms', rows);
}

async function generateAuctionSessions(
  productIds: number[],
  _ruleIds: number[],
  roomIds: number[],
  userIds: number[],
): Promise<{ sessionIds: number[]; endedSessionIds: number[] }> {
  console.log(`\n生成竞拍场次 (${SESSION_COUNT})...`);

  const endedSessionIds: number[] = [];
  const rows: Record<string, unknown>[] = [];
  const usedProducts = new Set<number>();

  for (let i = 1; i <= SESSION_COUNT; i++) {
    let productId: number;
    do {
      productId = randomItem(productIds);
    } while (usedProducts.has(productId));
    usedProducts.add(productId);

    const status = randomItem(['pending', 'active', 'active', 'ended', 'ended', 'ended']);
    const startedAt = randomTimestamp(7);
    const endedAt = status === 'ended' ? new Date(startedAt.getTime() + randomInt(60, 300) * 1000) : null;
    const winnerId = status === 'ended' ? randomItem(userIds) : null;
    const ruleId = productId; // auction_rules 的 id 与 product 一一对应

    rows.push({
      product_id: productId,
      rule_id: ruleId,
      room_id: randomItem(roomIds),
      status,
      current_price: status === 'ended' ? randomPrice(50, 1000) : randomPrice(0, 200),
      winner_id: winnerId,
      started_at: startedAt,
      ended_at: endedAt,
      extension_count: randomInt(0, 5),
      version: randomInt(0, 20),
    });
  }

  const sessionIds = await batchInsert('auction_sessions', rows);

  // 找出 ended 状态的 session
  rows.forEach((r, idx) => {
    if (r.status === 'ended') endedSessionIds.push(sessionIds[idx]);
  });

  return { sessionIds, endedSessionIds };
}

async function generateBidRecords(
  sessionIds: number[],
  userIds: number[],
): Promise<void> {
  console.log(`\n生成出价记录 (${BID_COUNT})...`);

  const rows: Record<string, unknown>[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < BID_COUNT; i++) {
    const sessionId = randomItem(sessionIds);
    const userId = randomItem(userIds);
    let idempotencyKey: string;
    do {
      idempotencyKey = randomUUID().replace(/-/g, '').substring(0, 16);
    } while (seenKeys.has(idempotencyKey));
    seenKeys.add(idempotencyKey);

    rows.push({
      session_id: sessionId,
      user_id: userId,
      bid_amount: randomPrice(10, 2000),
      idempotency_key: idempotencyKey,
      created_at: randomTimestamp(7),
    });

    if (rows.length >= BATCH_SIZE) {
      await batchInsert('bid_records', rows.splice(0, BATCH_SIZE));
    }
  }

  if (rows.length > 0) {
    await batchInsert('bid_records', rows);
  }
}

async function generateOrders(
  endedSessionIds: number[],
  userIds: number[],
  productIds: number[],
): Promise<void> {
  console.log(`\n生成订单 (${ORDER_COUNT})...`);

  const usedSessions = new Set<number>();
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < Math.min(ORDER_COUNT, endedSessionIds.length); i++) {
    let sessionId: number;
    do {
      sessionId = randomItem(endedSessionIds);
    } while (usedSessions.has(sessionId));
    usedSessions.add(sessionId);

    const productId = randomItem(productIds);
    rows.push({
      session_id: sessionId,
      buyer_id: randomItem(userIds),
      product_id: productId,
      final_price: randomPrice(50, 2000),
      status: randomItem(['pending_payment', 'paid', 'paid', 'paid', 'cancelled']),
      created_at: randomTimestamp(7),
      updated_at: new Date(),
    });
  }

  await batchInsert('orders', rows);
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('========================================');
  console.log(`模拟数据生成器 (倍数: ${MULTIPLIER}x)`);
  console.log('========================================');

  // 清空旧数据
  console.log('\n清空旧数据...');
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  const tables = ['bid_records', 'orders', 'auction_sessions', 'auction_rules', 'live_rooms', 'products', 'users'];
  for (const t of tables) {
    await db(t).truncate();
    console.log(`  truncated ${t}`);
  }
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');

  const startTime = Date.now();

  // 1. 用户
  const { merchantIds, userIds } = await generateUsers();

  // 2. 商品
  const productIds = await generateProducts(merchantIds);

  // 3. 竞拍规则
  const ruleIds = await generateAuctionRules(productIds);

  // 4. 直播间
  const roomIds = await generateLiveRooms(merchantIds);

  // 5. 竞拍场次
  const { sessionIds, endedSessionIds } = await generateAuctionSessions(
    productIds, ruleIds, roomIds, userIds,
  );

  // 6. 出价记录
  await generateBidRecords(sessionIds, userIds);

  // 7. 订单
  await generateOrders(endedSessionIds, userIds, productIds);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`完成！耗时 ${elapsed}s`);
  console.log(`  users:          ${MERCHANT_COUNT + USER_COUNT}`);
  console.log(`  products:       ${PRODUCT_COUNT}`);
  console.log(`  auction_rules:  ${ruleIds.length}`);
  console.log(`  live_rooms:     ${ROOM_COUNT}`);
  console.log(`  auction_sessions: ${SESSION_COUNT}`);
  console.log(`  bid_records:    ${BID_COUNT}`);
  console.log(`  orders:         ${Math.min(ORDER_COUNT, endedSessionIds.length)}`);
  console.log('========================================');

  await db.destroy();
}

main().catch((err) => {
  console.error('数据生成失败:', err);
  db.destroy().finally(() => process.exit(1));
});
