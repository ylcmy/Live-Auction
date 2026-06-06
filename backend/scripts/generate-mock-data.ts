/**
 * 临时脚本：生成大量模拟数据用于压力测试
 * 用法: npx tsx scripts/generate-mock-data.ts [数量倍数，默认1]
 * 示例: npx tsx scripts/generate-mock-data.ts 10  → 生成10倍数据
 *
 * 默认基准量（可通过命令行参数乘以倍数）:
 *   - 50 商家, 2000 普通用户
 *   - 500 商品, 500 竞拍规则
 *   - 50 直播间
 *   - 200 竞拍场次 (含 pending/active/ended/unsold 混合)
 *   - 50000 出价记录
 *   - 100 订单
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

/** 生成 [min, max] 范围内的整数价格（单位：元），保留两位小数格式 */
function randomIntPrice(min: number, max: number): number {
  return randomInt(min, max);
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

async function generateProducts(merchantIds: number[]): Promise<{ productIds: number[]; productMerchantMap: Map<number, number> }> {
  console.log(`\n生成商品 (${PRODUCT_COUNT})...`);
  const categories = ['数码', '美妆', '服饰', '家电', '食品', '图书', '玩具', '珠宝', '运动', '家居'];

  const productMerchantMap = new Map<number, number>();
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    const merchantId = randomItem(merchantIds);
    rows.push({
      merchant_id: merchantId,
      name: `商品${i} - ${randomItem(['限量', '新款', '热销', '经典', '爆款'])}${randomItem(categories)}`,
      description: `这是商品${i}的详细描述`,
      image_url: `https://picsum.photos/400/400?random=${i}`,
      category: randomItem(categories),
      status: 'listed',
      created_at: randomTimestamp(90),
      updated_at: new Date(),
    });
    productMerchantMap.set(i, merchantId);
  }

  const productIds = await batchInsert('products', rows);
  return { productIds, productMerchantMap };
}

interface AuctionRule {
  ruleId: number;
  productId: number;
  startPrice: number;
  bidIncrement: number;
  ceilingPrice: number | null;
  durationSeconds: number;
}

async function generateAuctionRules(productIds: number[]): Promise<{ ruleIds: number[]; ruleMap: Map<number, AuctionRule> }> {
  console.log(`\n生成竞拍规则 (${PRODUCT_COUNT})...`);

  const rows: Record<string, unknown>[] = [];
  for (const pid of productIds) {
    const increment = randomItem([5, 10, 20, 50, 100]);
    const ceiling = Math.random() > 0.3 ? randomIntPrice(20, 200) * increment : null;
    rows.push({
      product_id: pid,
      start_price: 0.0,
      bid_increment: increment,
      ceiling_price: ceiling,
      duration_seconds: randomItem([60, 120, 180, 300]),
      extend_seconds: 20,
      max_extensions: randomItem([5, 10, 15]),
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const ruleIds = await batchInsert('auction_rules', rows);

  const ruleMap = new Map<number, AuctionRule>();
  rows.forEach((r, idx) => {
    ruleMap.set(r.product_id as number, {
      ruleId: ruleIds[idx],
      productId: r.product_id as number,
      startPrice: r.start_price as number,
      bidIncrement: r.bid_increment as number,
      ceilingPrice: r.ceiling_price as number | null,
      durationSeconds: r.duration_seconds as number,
    });
  });

  return { ruleIds, ruleMap };
}

async function generateLiveRooms(merchantIds: number[]): Promise<{ roomIds: number[]; merchantRoomMap: Map<number, number> }> {
  console.log(`\n生成直播间 (${ROOM_COUNT})...`);

  const merchantRoomMap = new Map<number, number>();
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < ROOM_COUNT; i++) {
    const hostId = merchantIds[i % merchantIds.length];
    rows.push({
      host_id: hostId,
      title: `直播间${i + 1} - ${randomItem(['限时抢购', '秒杀专场', '新品首发', '品牌特卖', '捡漏专区'])}`,
      status: randomItem(['offline', 'live', 'live', 'live']),
      stream_url: null,
      created_at: randomTimestamp(30),
      updated_at: new Date(),
    });
    merchantRoomMap.set(hostId, i + 1);
  }

  const roomIds = await batchInsert('live_rooms', rows);
  const insertedMerchantRoomMap = new Map<number, number>();
  rows.forEach((r, idx) => {
    insertedMerchantRoomMap.set(r.host_id as number, roomIds[idx]);
  });
  return { roomIds, merchantRoomMap: insertedMerchantRoomMap };
}

async function generateAuctionSessions(
  productIds: number[],
  productMerchantMap: Map<number, number>,
  merchantRoomMap: Map<number, number>,
  ruleMap: Map<number, AuctionRule>,
  userIds: number[],
): Promise<{ sessionIds: number[]; endedSessionIds: number[]; sessionRuleMap: Map<number, AuctionRule>; sessionProductMap: Map<number, string> }> {
  console.log(`\n生成竞拍场次 (${SESSION_COUNT})...`);

  const endedSessionIds: number[] = [];
  const sessionProductMap = new Map<number, string>();
  const sessionRuleMap = new Map<number, AuctionRule>();
  const rows: Record<string, unknown>[] = [];
  const usedProducts = new Set<number>();

  for (let i = 1; i <= SESSION_COUNT; i++) {
    let productId: number;
    do {
      productId = randomItem(productIds);
    } while (usedProducts.has(productId));
    usedProducts.add(productId);

    const rule = ruleMap.get(productId);
    if (!rule) continue;

    const status = randomItem(['pending', 'active', 'active', 'ended', 'ended', 'ended', 'unsold']);
    const startedAt = randomTimestamp(7);
    const endedAt = status === 'ended' || status === 'unsold' ? new Date(startedAt.getTime() + randomInt(60, 300) * 1000) : null;
    const winnerId = status === 'ended' ? randomItem(userIds) : null;

    const productStatus = status === 'pending' || status === 'active' ? 'active'
      : status === 'cancelled' ? 'listed'
      : status;
    sessionProductMap.set(productId, productStatus);

    const merchantId = productMerchantMap.get(productId);
    const roomId = merchantId != null ? merchantRoomMap.get(merchantId) : undefined;
    if (roomId == null) continue;

    // 根据竞拍规则计算合理的 current_price
    const maxBids = rule.ceilingPrice != null
      ? Math.floor((rule.ceilingPrice - rule.startPrice) / rule.bidIncrement)
      : 200;
    let currentPrice: number;
    if (status === 'pending') {
      currentPrice = rule.startPrice;
    } else if (status === 'active') {
      const bids = randomInt(1, Math.min(maxBids, 20));
      currentPrice = rule.startPrice + bids * rule.bidIncrement;
    } else {
      const bids = randomInt(1, maxBids);
      currentPrice = rule.startPrice + bids * rule.bidIncrement;
    }

    rows.push({
      product_id: productId,
      rule_id: rule.ruleId,
      room_id: roomId,
      status,
      current_price: currentPrice,
      winner_id: winnerId,
      started_at: startedAt,
      ended_at: endedAt,
      extension_count: randomInt(0, 5),
      version: randomInt(0, 20),
    });
  }

  const sessionIds = await batchInsert('auction_sessions', rows);

  rows.forEach((r, idx) => {
    if (r.status === 'ended') endedSessionIds.push(sessionIds[idx]);
    sessionRuleMap.set(sessionIds[idx], ruleMap.get(r.product_id as number)!);
  });

  return { sessionIds, endedSessionIds, sessionRuleMap, sessionProductMap };
}

async function generateBidRecords(
  sessionIds: number[],
  sessionRuleMap: Map<number, AuctionRule>,
  userIds: number[],
): Promise<void> {
  console.log(`\n生成出价记录 (${BID_COUNT})...`);

  const rows: Record<string, unknown>[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < BID_COUNT; i++) {
    const sessionId = randomItem(sessionIds);
    const userId = randomItem(userIds);
    const rule = sessionRuleMap.get(sessionId);

    // 根据规则计算出价金额：start_price + N * bid_increment，不超 ceiling_price
    let bidAmount: number;
    if (rule) {
      const maxBids = rule.ceilingPrice != null
        ? Math.floor((rule.ceilingPrice - rule.startPrice) / rule.bidIncrement)
        : 200;
      const n = randomInt(1, Math.max(maxBids, 1));
      bidAmount = rule.startPrice + n * rule.bidIncrement;
    } else {
      bidAmount = randomInt(1, 200) * 10;
    }

    let idempotencyKey: string;
    do {
      idempotencyKey = randomUUID().replace(/-/g, '').substring(0, 16);
    } while (seenKeys.has(idempotencyKey));
    seenKeys.add(idempotencyKey);

    rows.push({
      session_id: sessionId,
      user_id: userId,
      bid_amount: bidAmount,
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
  sessionRuleMap: Map<number, AuctionRule>,
  userIds: number[],
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

    const rule = sessionRuleMap.get(sessionId);
    // final_price 取自会话对应的竞拍规则的合理价格
    let finalPrice: number;
    if (rule) {
      const maxBids = rule.ceilingPrice != null
        ? Math.floor((rule.ceilingPrice - rule.startPrice) / rule.bidIncrement)
        : 200;
      const n = randomInt(1, maxBids);
      finalPrice = rule.startPrice + n * rule.bidIncrement;
    } else {
      finalPrice = randomInt(1, 200) * 10;
    }

    const orderStatus = randomItem(['pending_payment', 'paid', 'paid', 'paid', 'cancelled']);
    const createdAt = randomTimestamp(7);
    const expireAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    const paidAt = orderStatus === 'paid' ? new Date(createdAt.getTime() + randomInt(60, 1800) * 1000) : null;

    rows.push({
      session_id: sessionId,
      buyer_id: randomItem(userIds),
      product_id: rule?.productId ?? 0,
      final_price: finalPrice,
      status: orderStatus,
      created_at: createdAt,
      updated_at: new Date(),
      paid_at: paidAt,
      expire_at: expireAt,
      payment_method: orderStatus === 'paid' ? randomItem(['alipay', 'wechat']) : null,
      transaction_id: orderStatus === 'paid' ? randomUUID().replace(/-/g, '').substring(0, 32) : null,
    });
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

  const { productIds, productMerchantMap } = await generateProducts(merchantIds);

  const { ruleIds, ruleMap } = await generateAuctionRules(productIds);

  const { roomIds, merchantRoomMap } = await generateLiveRooms(merchantIds);

  const { sessionIds, endedSessionIds, sessionRuleMap, sessionProductMap } = await generateAuctionSessions(
    productIds, productMerchantMap, merchantRoomMap, ruleMap, userIds,
  );

  console.log('\n同步商品状态...');
  for (const [productId, productStatus] of sessionProductMap) {
    await db('products').where({ id: productId }).update({ status: productStatus });
  }
  console.log(`  已同步 ${sessionProductMap.size} 个商品状态`);

  await generateBidRecords(sessionIds, sessionRuleMap, userIds);

  await generateOrders(endedSessionIds, sessionRuleMap, userIds);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`完成！耗时 ${elapsed}s`);
  console.log(`  users:            ${MERCHANT_COUNT + USER_COUNT}`);
  console.log(`  products:         ${PRODUCT_COUNT}`);
  console.log(`  auction_rules:    ${ruleIds.length}`);
  console.log(`  live_rooms:       ${ROOM_COUNT}`);
  console.log(`  auction_sessions: ${SESSION_COUNT}`);
  console.log(`  bid_records:      ${BID_COUNT}`);
  console.log(`  orders:           ${Math.min(ORDER_COUNT, endedSessionIds.length)}`);
  console.log('========================================');

  await db.destroy();
}

main().catch((err) => {
  console.error('数据生成失败:', err);
  db.destroy().finally(() => process.exit(1));
});
