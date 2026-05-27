export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
  timestamp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nickname: string;
  role: 'merchant' | 'user';
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  status: ProductStatus;
  rule?: AuctionRule;
}

export type ProductStatus =
  | 'pending'
  | 'listed'
  | 'active'
  | 'ended'
  | 'unsold'
  | 'deleted';

export interface AuctionRule {
  id: number;
  productId: number;
  startPrice: number;
  bidIncrement: number;
  ceilingPrice: number | null;
  durationSeconds: number;
  extendSeconds: number;
  maxExtensions: number;
}

export interface AuctionSession {
  id: number;
  productId: number;
  product?: Product;
  rule?: AuctionRule;
  roomId: number;
  status: AuctionStatus;
  currentPrice: number;
  winnerId: number | null;
  startedAt: string | null;
  endedAt: string | null;
  extensionCount: number;
  participantCount: number;
}

export type AuctionStatus =
  | 'pending'
  | 'active'
  | 'ended'
  | 'cancelled'
  | 'unsold';

export interface BidRecord {
  id: number;
  sessionId: number;
  userId: number;
  bidAmount: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface Order {
  id: number;
  sessionId: number;
  buyerId: number;
  productId: number;
  finalPrice: number;
  status: OrderStatus;
  createdAt: string;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'cancelled';

export interface User {
  id: number;
  username: string;
  role: 'merchant' | 'user';
  nickname: string;
  avatarUrl: string | null;
}

export interface LiveRoom {
  id: number;
  hostId: number;
  title: string;
  status: 'offline' | 'live';
  streamUrl: string | null;
  currentAuction?: AuctionSession | null;
  auctions?: RoomAuctionItem[];
  onlineCount: number;
}

export interface RoomAuctionItem {
  sessionId: number;
  status: AuctionStatus;
  currentPrice: number;
  startedAt: string | null;
  endedAt: string | null;
  extensionCount: number;
  product: {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
  } | null;
  rule: {
    startPrice: number;
    bidIncrement: number;
    ceilingPrice: number | null;
    durationSeconds: number;
    extendSeconds: number;
    maxExtensions: number;
  };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
