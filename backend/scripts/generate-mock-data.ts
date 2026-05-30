/**
 * 模拟数据生成脚本（适配实际数据库 schema）
 * 用法: npx tsx scripts/generate-mock-data.ts [数量倍数，默认1]
 * 示例: npx tsx scripts/generate-mock-data.ts 10  → 生成10倍数据
 *
 * 默认基准量（可通过命令行参数乘以倍数）:
 *   - 50 商家, 2000 普通用户
 *   - 500 商品, 500 竞拍规则
 *   - 50 直播间
 *   - 200 竞拍场次 (含 pending/active/ended/unsold/cancelled 混合)
 *   - 50000 出价记录
 *   - 100 订单
 *
 * 适配要点（基于实际数据库 SHOW CREATE TABLE 结果）:
 *   1. auction_rules: 无 updated_at，无 UNIQUE(product_id)
 *   2. auction_sessions: 无 rule_id/version/extension_count，有 extend_count/ends_at
 *   3. products: status 为 VARCHAR(50) 非 ENUM，有 owner_id/images/start_price
 *   4. bid_records: 出价金额字段为 amount 非 bid_amount
 *   5. orders: 无 buyer_id/product_id/final_price/expire_at/completed_at/cancelled_at/
 *      payment_method，有 user_id/amount/transaction_id/paid_at
 *   6. live_rooms: 无 UNIQUE(host_id)，有 updated_at
 *   7. users: 有 password/avatar/avatar_url/phone 字段
 */

import { db } from '../src/infrastructure/db/knex.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const MULTIPLIER = Math.max(1, parseInt(process.argv[2] || '1', 10));

const MERCHANT_COUNT = 50 * MULTIPLIER;
const USER_COUNT = 2000 * MULTIPLIER;
const PRODUCT_COUNT = 500 * MULTIPLIER;
const ROOM_COUNT = 50 * MULTIPLIER;
const SESSION_COUNT = 200 * MULTIPLIER;
const BID_COUNT = 50000 * MULTIPLIER;
const ORDER_COUNT = 100 * MULTIPLIER;

const BATCH_SIZE = 1000;

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
    const firstId = Array.isArray(result) ? (result[0] as number) : (result as number);
    for (let j = 0; j < chunk.length; j++) {
      ids.push(firstId + j);
    }
    console.log(`  [${table}] 已插入 ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  return ids;
}

async function generateUsers(): Promise<{ merchantIds: number[]; userIds: number[] }> {
  console.log(`\n生成用户 (${MERCHANT_COUNT} 商家 + ${USER_COUNT} 普通用户)...`);
  const hash = await bcrypt.hash('pass1234', 10);

  const merchants: Record<string, unknown>[] = [];
  for (let i = 1; i <= MERCHANT_COUNT; i++) {
    merchants.push({
      username: `merchant_${i}`,
      password_hash: hash,
      password: 'pass1234',
      role: 'merchant',
      nickname: `商家${String(i).padStart(3, '0')}`,
      avatar: '',
      avatar_url: '',
      phone: `138${String(randomInt(10000000, 99999999))}`,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const users: Record<string, unknown>[] = [];
  for (let i = 1; i <= USER_COUNT; i++) {
    users.push({
      username: `user_${i}`,
      password_hash: hash,
      password: 'pass1234',
      role: 'user',
      nickname: `竞拍用户${String(i).padStart(4, '0')}`,
      avatar: '',
      avatar_url: '',
      phone: `159${String(randomInt(10000000, 99999999))}`,
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

  // 实际 DB: status VARCHAR(50)，常见值 pending/listed/active/ended/unsold/deleted
  const statusWeights: string[] = [
    ...Array(15).fill('listed'),
    ...Array(5).fill('pending'),
    ...Array(3).fill('active'),
    ...Array(40).fill('ended'),
    ...Array(20).fill('unsold'),
    ...Array(2).fill('deleted'),
  ];

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    const merchantId = randomItem(merchantIds);
    const startPrice = randomPrice(0, 500);
    rows.push({
      name: `商品${i} - ${randomItem(['限量', '新款', '热销', '经典', '爆款'])}${randomItem(categories)}`,
      description: `这是商品${i}的详细描述，品质保证，假一赔十`,
      images: null,
      category: randomItem(categories),
      image_url: `https://picsum.photos/400/400?random=${i}`,
      start_price: startPrice,
      owner_id: merchantId,
      merchant_id: merchantId,
      room_id: null,
      status: randomItem(statusWeights),
      created_at: randomTimestamp(90),
      updated_at: new Date(),
    });
  }

  return batchInsert('products', rows);
}

async function generateAuctionRules(productIds: number[]): Promise<number[]> {
  console.log(`\n生成竞拍规则 (${PRODUCT_COUNT})...`);

  // 实际 DB: auction_rules 无 updated_at 列
  const rows: Record<string, unknown>[] = [];
  for (const pid of productIds) {
    const bidIncrement = randomItem([5, 10, 20, 50, 100]);
    const startPrice = randomPrice(0, 500);
    rows.push({
      product_id: pid,
      start_price: startPrice,
      bid_increment: bidIncrement,
      ceiling_price: Math.random() > 0.3 ? randomPrice(startPrice + bidIncrement * 10, startPrice + bidIncrement * 50) : null,
      duration_seconds: randomItem([60, 120, 180, 300]),
      extend_seconds: randomItem([10, 15, 20, 30]),
      max_extensions: randomItem([3, 5, 10, 15]),
      created_at: new Date(),
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
      updated_at: new Date(),
    });
  }

  return batchInsert('live_rooms', rows);
}

interface SessionRow {
  id: number;
  product_id: number;
  room_id: number;
  status: string;
  current_price: number;
  winner_id: number | null;
  ends_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  extend_count: number;
}

async function generateAuctionSessions(
  productIds: number[],
  roomIds: number[],
  userIds: number[],
): Promise<{ sessionIds: number[]; endedSessionIds: number[] }> {
  console.log(`\n生成竞拍场次 (${SESSION_COUNT})...`);

  const endedSessionIds: number[] = [];
  const rows: Record<string, unknown>[] = [];
  const usedProducts = new Set<number>();

  // 实际 DB: auction_sessions 无 rule_id/version/extension_count
  // 有 extend_count, ends_at
  const statusWeights: string[] = [
    ...Array(5).fill('pending'),
    ...Array(10).fill('active'),
    ...Array(45).fill('ended'),
    ...Array(25).fill('unsold'),
    ...Array(5).fill('cancelled'),
  ];

  for (let i = 1; i <= SESSION_COUNT; i++) {
    let productId: number;
    do {
      productId = randomItem(productIds);
    } while (usedProducts.has(productId) && usedProducts.size < productIds.length);
    if (usedProducts.size >= productIds.length) break;
    usedProducts.add(productId);

    const status = randomItem(statusWeights);
    const startedAt = status === 'pending' ? null : randomTimestamp(7);
    const endedAt = (status === 'ended' || status === 'unsold' || status === 'cancelled')
      ? new Date(startedAt!.getTime() + randomInt(60, 300) * 1000)
      : null;
    const endsAt = (status === 'active')
      ? new Date(startedAt!.getTime() + randomInt(60, 300) * 1000)
      : endedAt;
    const winnerId = status === 'ended' ? randomItem(userIds) : null;

    let currentPrice: number;
    switch (status) {
      case 'pending':
        currentPrice = randomPrice(0, 500);
        break;
      case 'active':
        currentPrice = randomPrice(50, 1500);
        break;
      case 'ended':
        currentPrice = randomPrice(100, 3000);
        break;
      case 'unsold':
        currentPrice = randomPrice(0, 100);
        break;
      case 'cancelled':
        currentPrice = randomPrice(0, 500);
        break;
      default:
        currentPrice = 0;
    }

    rows.push({
      product_id: productId,
      room_id: randomItem(roomIds),
      status,
      current_price: currentPrice,
      winner_id: winnerId,
      ends_at: endsAt,
      started_at: startedAt,
      ended_at: endedAt,
      extend_count: status === 'active' || status === 'ended' ? randomInt(0, 5) : 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const sessionIds = await batchInsert('auction_sessions', rows);

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

  // 实际 DB: bid_records 出价金额字段为 amount 非 bid_amount
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
      amount: randomPrice(10, 2000),
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
): Promise<void> {
  console.log(`\n生成订单 (${ORDER_COUNT})...`);

  // 实际 DB: orders 字段为 session_id/user_id/amount/status/transaction_id/paid_at
  // 无 buyer_id/product_id/final_price/expire_at/completed_at/cancelled_at/payment_method
  const usedSessions = new Set<number>();
  const rows: Record<string, unknown>[] = [];

  const orderCount = Math.min(ORDER_COUNT, endedSessionIds.length);

  for (let i = 0; i < orderCount; i++) {
    let sessionId: number;
    do {
      sessionId = randomItem(endedSessionIds);
    } while (usedSessions.has(sessionId));
    usedSessions.add(sessionId);

    const orderStatus = randomItem(['pending_payment', 'paid', 'paid', 'completed', 'completed', 'cancelled']);
    const createdAt = randomTimestamp(7);

    const row: Record<string, unknown> = {
      session_id: sessionId,
      user_id: randomItem(userIds),
      amount: randomPrice(50, 2000),
      status: orderStatus,
      transaction_id: null,
      paid_at: null,
      created_at: createdAt,
      updated_at: new Date(),
    };

    if (orderStatus === 'paid' || orderStatus === 'completed') {
      row.paid_at = new Date(createdAt.getTime() + randomInt(1, 5) * 60 * 1000);
      row.transaction_id = `TXN${createdAt.getTime()}${randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()}`;
    }

    rows.push(row);
  }

  await batchInsert('orders', rows);
}

async function main() {
  console.log('========================================');
  console.log(`模拟数据生成器 (倍数: ${MULTIPLIER}x)`);
  console.log('========================================');

  console.log('\n清空旧数据...');
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  const tables = ['bid_records', 'orders', 'auction_sessions', 'auction_rules', 'live_rooms', 'products', 'users'];
  for (const t of tables) {
    await db(t).truncate();
    console.log(`  truncated ${t}`);
  }
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');

  const startTime = Date.now();

  const { merchantIds, userIds } = await generateUsers();

  const productIds = await generateProducts(merchantIds);

  const ruleIds = await generateAuctionRules(productIds);

  const roomIds = await generateLiveRooms(merchantIds);

  const { sessionIds, endedSessionIds } = await generateAuctionSessions(
    productIds, roomIds, userIds,
  );

  await generateBidRecords(sessionIds, userIds);

  await generateOrders(endedSessionIds, userIds);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`完成！耗时 ${elapsed}s`);
  console.log(`  users:            ${MERCHANT_COUNT + USER_COUNT}`);
  console.log(`  products:         ${PRODUCT_COUNT}`);
  console.log(`  auction_rules:    ${ruleIds.length}`);
  console.log(`  live_rooms:       ${roomIds.length}`);
  console.log(`  auction_sessions: ${sessionIds.length}`);
  console.log(`  bid_records:      ${BID_COUNT}`);
  console.log(`  orders:           ${Math.min(ORDER_COUNT, endedSessionIds.length)}`);
  console.log('========================================');

  await db.destroy();
}

main().catch((err) => {
  console.error('数据生成失败:', err);
  db.destroy().finally(() => process.exit(1));
});
