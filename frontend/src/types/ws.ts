import type { AuctionStatus } from './api';

export interface WsEvents {
  'auction:state': AuctionState;
  'bid:accepted': { sessionId: number; idempotencyKey: string; bidId: number; amount: number; rank: number; isLeading: boolean; gapToLeader: number };
  'bid:rejected': { sessionId: number; idempotencyKey: string; reason?: string; code?: number };
  'bid:new': { sessionId: number; userId: number; userNickname: string; amount: number; timestamp: string; newTopBid: boolean };
  'rank:update': LeaderboardEntry[];
  'auction:ended': AuctionEndResult;
  'auction:started': AuctionStartedEvent;
  'auction:cancelled': { sessionId: number; reason?: string };
  'countdown:sync': CountdownSync;
  'countdown:extend': CountdownExtendEvent;
  'emotion:lead': { sessionId: number; userId?: number; amount?: number };
  'emotion:overtaken': { sessionId: number; userId: number; newAmount: number };
  'room:status': { roomId: number; status: string };
  'room:count': { onlineCount: number; participantCount: number };
  'room-list:update': unknown;
  'chat:broadcast': ChatMessage;
}

export interface AuctionState {
  sessionId: number;
  status: AuctionStatus;
  product: {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
  };
  rule: {
    startPrice: number;
    bidIncrement: number;
    ceilingPrice: number | null;
    durationSeconds: number;
    extendSeconds: number;
    maxExtensions: number;
  };
  currentPrice: number;
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
  myBidAmount: number | null;
  remainingMs: number;
  startedAt: string;
  participantCount: number;
  extensionCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  userNickname: string;
  avatarUrl: string | null;
  amount: number;
  timestamp: string;
  isCurrentUser?: boolean;
}

export interface BidBroadcast {
  sessionId: number;
  userId: number;
  userNickname: string;
  amount: number;
  timestamp: string;
  newTopBid: boolean;
}

export interface BidResult {
  sessionId: number;
  bidId: number;
  amount: number;
  rank: number;
  isLeading: boolean;
  gapToLeader: number;
}

export interface AuctionEndResult {
  sessionId: number;
  status: 'ended' | 'unsold';
  winner: {
    userId: number;
    userNickname: string;
    finalPrice: number;
  } | null;
  leaderboard: LeaderboardEntry[];
  orderId: number | null;
  orderCreated?: boolean;
}

export interface CountdownSync {
  sessionId: number;
  remainingMs: number;
  serverTime: number;
}

export interface ExtendSync {
  sessionId: number;
  extendMs: number;
  serverTime: number;
}

export interface EmotionEvent {
  id?: string;
  sessionId: number;
  userId?: number;
  amount?: number;
  type: 'lead' | 'overtaken' | 'extended' | 'ended' | 'cancelled';
  extendSeconds?: number;
}

export interface AuctionStartedEvent {
  sessionId: number;
  status: 'active';
  product: {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
  };
  rule: {
    startPrice: number;
    bidIncrement: number;
    ceilingPrice: number | null;
    durationSeconds: number;
    extendSeconds: number;
    maxExtensions: number;
  };
  currentPrice: number;
  startedAt: string;
  extensionCount: number;
}

export interface CountdownExtendEvent {
  sessionId: number;
  extendSeconds: number;
  remainingExtensions: number;
  serverTime?: number;
}

export interface ChatMessage {
  userId: number;
  userNickname: string;
  avatarUrl: string | null;
  content: string;
  timestamp: string;
}
