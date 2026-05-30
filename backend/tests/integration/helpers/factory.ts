import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../../src/infrastructure/db/knex.js';
import { env } from '../../../src/config/env.js';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export function generateToken(userId: number, role: 'merchant' | 'user', expiresIn = '1h'): string {
  return jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn });
}

export function authHeader(userId: number, role: 'merchant' | 'user'): { Authorization: string } {
  return { Authorization: `Bearer ${generateToken(userId, role)}` };
}

// ---------------------------------------------------------------------------
// DB seed helpers
// ---------------------------------------------------------------------------

export async function seedUser(overrides: Partial<{
  username: string;
  password: string;
  role: 'merchant' | 'user';
  nickname: string;
}> = {}): Promise<{ id: number; username: string; role: 'merchant' | 'user'; nickname: string }> {
  const username = overrides.username ?? `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const password = overrides.password ?? 'Pass123456';
  const role = overrides.role ?? 'user';
  const nickname = overrides.nickname ?? `nick_${Date.now()}`;

  const password_hash = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({ username, password_hash, role, nickname });
  return { id: Number(id), username, role, nickname };
}

export async function seedProduct(merchantId: number, overrides: Partial<{
  name: string;
  description: string;
  image_url: string;
  category: string;
  status: string;
  rule: {
    startPrice: number;
    bidIncrement: number;
    ceilingPrice?: number | null;
    durationSeconds: number;
    extendSeconds: number;
    maxExtensions?: number;
  };
}> = {}): Promise<{ productId: number; ruleId: number }> {
  const [productId] = await db('products').insert({
    merchant_id: merchantId,
    name: overrides.name ?? `product_${Date.now()}`,
    description: overrides.description ?? 'Test product',
    image_url: overrides.image_url ?? null,
    category: overrides.category ?? 'general',
    status: overrides.status ?? 'listed',
  });

  const ruleData = overrides.rule ?? {
    startPrice: 100,
    bidIncrement: 10,
    durationSeconds: 300,
    extendSeconds: 30,
    maxExtensions: 5,
  };

  const [ruleId] = await db('auction_rules').insert({
    product_id: Number(productId),
    start_price: ruleData.startPrice,
    bid_increment: ruleData.bidIncrement,
    ceiling_price: ruleData.ceilingPrice ?? null,
    duration_seconds: ruleData.durationSeconds,
    extend_seconds: ruleData.extendSeconds,
    max_extensions: ruleData.maxExtensions ?? 10,
  });

  return { productId: Number(productId), ruleId: Number(ruleId) };
}

export async function seedRoom(hostId: number, overrides: Partial<{
  title: string;
  status: 'offline' | 'live';
  stream_url: string;
}> = {}): Promise<number> {
  const [id] = await db('live_rooms').insert({
    host_id: hostId,
    title: overrides.title ?? `room_${Date.now()}`,
    status: overrides.status ?? 'offline',
    stream_url: overrides.stream_url ?? null,
  });
  return Number(id);
}

export async function seedAuctionSession(data: {
  productId: number;
  ruleId: number;
  roomId: number;
  status?: string;
  currentPrice?: number;
}): Promise<number> {
  const [id] = await db('auction_sessions').insert({
    product_id: data.productId,
    rule_id: data.ruleId,
    room_id: data.roomId,
    status: data.status ?? 'active',
    current_price: data.currentPrice ?? 100,
    started_at: new Date(),
  });
  return Number(id);
}

export async function seedOrder(data: {
  sessionId: number;
  buyerId: number;
  productId: number;
  finalPrice: number;
  status?: string;
}): Promise<number> {
  const [id] = await db('orders').insert({
    session_id: data.sessionId,
    buyer_id: data.buyerId,
    product_id: data.productId,
    final_price: data.finalPrice,
    status: data.status ?? 'pending_payment',
    expire_at: new Date(Date.now() + 15 * 60 * 1000),
  });
  return Number(id);
}

// ---------------------------------------------------------------------------
// Cleanup helper (use in beforeEach)
// ---------------------------------------------------------------------------

export async function truncateAll(): Promise<void> {
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  await db('bid_records').truncate();
  await db('orders').truncate();
  await db('auction_sessions').truncate();
  await db('auction_rules').truncate();
  await db('products').truncate();
  await db('live_rooms').truncate();
  await db('users').truncate();
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
}
