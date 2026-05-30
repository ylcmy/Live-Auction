/**
 * 测试数据工厂函数
 *
 * 每个工厂函数接收可选的 Partial 覆盖参数，返回完整的测试对象。
 * 字段名与数据库迁移文件保持一致。
 */

let idCounter = 1;

const nextId = (): number => idCounter++;

// ---------------------------------------------------------------------------
// User
// Migration: 001_create_users.ts
// Schema: id, username, password_hash, role('merchant'|'user'), nickname,
//         avatar_url, created_at, updated_at
// ---------------------------------------------------------------------------

export interface TestUser {
  id: number;
  username: string;
  password_hash: string;
  role: 'merchant' | 'user';
  nickname: string;
  avatar_url: string;
  created_at: Date;
  updated_at: Date;
}

export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const id = nextId();
  return {
    id,
    username: `testuser_${id}`,
    password_hash:
      '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12',
    role: 'user',
    nickname: `测试用户${id}`,
    avatar_url: '',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Product
// Migration: 002_create_products.ts + 009_product_status_redesign.ts
// Schema: id, merchant_id, name, description, image_url, category,
//         status('pending'|'listed'|'active'|'ended'|'unsold'|'deleted'),
//         created_at, updated_at
// ---------------------------------------------------------------------------

export interface TestProduct {
  id: number;
  merchant_id: number;
  name: string;
  description: string;
  image_url: string;
  category: string;
  status: 'pending' | 'listed' | 'active' | 'ended' | 'unsold' | 'deleted';
  created_at: Date;
  updated_at: Date;
}

export function createTestProduct(overrides?: Partial<TestProduct>): TestProduct {
  const id = nextId();
  return {
    id,
    merchant_id: 1,
    name: `测试商品${id}`,
    description: '测试商品描述',
    image_url: 'https://example.com/img.jpg',
    category: '电子产品',
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AuctionRule
// Migration: 003_create_auction_rules.ts
// Schema: id, product_id, start_price, bid_increment, ceiling_price,
//         duration_seconds, extend_seconds, max_extensions,
//         created_at, updated_at
// ---------------------------------------------------------------------------

export interface TestAuctionRule {
  id: number;
  product_id: number;
  start_price: number;
  bid_increment: number;
  ceiling_price: number | null;
  duration_seconds: number;
  extend_seconds: number;
  max_extensions: number;
  created_at: Date;
  updated_at: Date;
}

export function createTestRule(
  overrides?: Partial<TestAuctionRule>,
): TestAuctionRule {
  const id = nextId();
  return {
    id,
    product_id: 1,
    start_price: 100,
    bid_increment: 10,
    ceiling_price: 500,
    duration_seconds: 60,
    extend_seconds: 20,
    max_extensions: 10,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LiveRoom
// Migration: 004_create_live_rooms.ts
// Schema: id, host_id, title, status('offline'|'live'), stream_url,
//         created_at
// ---------------------------------------------------------------------------

export interface TestLiveRoom {
  id: number;
  host_id: number;
  title: string;
  status: 'offline' | 'live';
  stream_url: string;
  created_at: Date;
}

export function createTestRoom(overrides?: Partial<TestLiveRoom>): TestLiveRoom {
  const id = nextId();
  return {
    id,
    host_id: 1,
    title: `测试直播间${id}`,
    status: 'live',
    stream_url: 'https://example.com/stream',
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AuctionSession
// Migration: 005_create_auction_sessions.ts
// Schema: id, product_id, rule_id, room_id,
//         status('pending'|'active'|'ended'|'cancelled'|'unsold'),
//         current_price, winner_id, started_at, ended_at,
//         extension_count, version, created_at, updated_at
// ---------------------------------------------------------------------------

export interface TestAuctionSession {
  id: number;
  product_id: number;
  rule_id: number;
  room_id: number;
  status: 'pending' | 'active' | 'ended' | 'cancelled' | 'unsold';
  current_price: number;
  winner_id: number | null;
  started_at: Date | null;
  ended_at: Date | null;
  extension_count: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export function createTestSession(
  overrides?: Partial<TestAuctionSession>,
): TestAuctionSession {
  const id = nextId();
  return {
    id,
    product_id: 1,
    rule_id: 1,
    room_id: 1,
    status: 'pending',
    current_price: 0,
    winner_id: null,
    started_at: null,
    ended_at: null,
    extension_count: 0,
    version: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BidRecord
// Migration: 006_create_bid_records.ts
// Schema: id, session_id, user_id, bid_amount, idempotency_key, created_at
// ---------------------------------------------------------------------------

export interface TestBidRecord {
  id: number;
  session_id: number;
  user_id: number;
  bid_amount: number;
  idempotency_key: string;
  created_at: Date;
}

export function createTestBid(overrides?: Partial<TestBidRecord>): TestBidRecord {
  const id = nextId();
  return {
    id,
    session_id: 1,
    user_id: 1,
    bid_amount: 110,
    idempotency_key: `idem_${id}_${Date.now()}`,
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Order
// Migration: 007_create_orders.ts + 011_order_payment_fields.ts
// Schema: id, session_id, buyer_id, product_id, final_price,
//         status('pending_payment'|'paid'|'cancelled'),
//         paid_at, cancelled_at, completed_at, expire_at,
//         payment_method, transaction_id, created_at, updated_at
// ---------------------------------------------------------------------------

export interface TestOrder {
  id: number;
  session_id: number;
  buyer_id: number;
  product_id: number;
  final_price: number;
  status: 'pending_payment' | 'paid' | 'cancelled';
  paid_at: Date | null;
  cancelled_at: Date | null;
  completed_at: Date | null;
  expire_at: Date;
  payment_method: string | null;
  transaction_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export function createTestOrder(overrides?: Partial<TestOrder>): TestOrder {
  const id = nextId();
  return {
    id,
    session_id: 1,
    buyer_id: 1,
    product_id: 1,
    final_price: 500,
    status: 'pending_payment',
    paid_at: null,
    cancelled_at: null,
    completed_at: null,
    expire_at: new Date(Date.now() + 15 * 60 * 1000),
    payment_method: null,
    transaction_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function resetIdCounter(): void {
  idCounter = 1;
}
