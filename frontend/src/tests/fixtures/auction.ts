import type { RoomAuctionItem } from '@/types/api';
import type { AuctionState, LeaderboardEntry, BidResult, EmotionEvent, CountdownSync, ChatMessage } from '@/types/ws';

export const mockRoomAuctionItem: RoomAuctionItem = {
  sessionId: 1,
  status: 'active',
  currentPrice: 100,
  startedAt: new Date(Date.now() - 60000).toISOString(),
  endedAt: null,
  extensionCount: 0,
  product: {
    id: 1,
    name: '测试商品',
    description: '测试商品描述',
    imageUrl: 'https://example.com/img.jpg',
  },
  rule: {
    startPrice: 50,
    bidIncrement: 10,
    ceilingPrice: 500,
    durationSeconds: 60,
    extendSeconds: 20,
    maxExtensions: 10,
  },
};

export const mockListedAuction: RoomAuctionItem = {
  sessionId: 2,
  status: 'listed',
  currentPrice: 0,
  startedAt: null,
  endedAt: null,
  extensionCount: 0,
  product: {
    id: 2,
    name: '待拍商品',
    description: null,
    imageUrl: null,
  },
  rule: {
    startPrice: 80,
    bidIncrement: 5,
    ceilingPrice: null,
    durationSeconds: 90,
    extendSeconds: 30,
    maxExtensions: 5,
  },
};

export const mockEndedAuction: RoomAuctionItem = {
  sessionId: 3,
  status: 'ended',
  currentPrice: 500,
  startedAt: new Date(Date.now() - 120000).toISOString(),
  endedAt: new Date().toISOString(),
  extensionCount: 2,
  product: {
    id: 3,
    name: '已结束商品',
    description: '已结束商品描述',
    imageUrl: 'https://example.com/img3.jpg',
  },
  rule: {
    startPrice: 100,
    bidIncrement: 20,
    ceilingPrice: 1000,
    durationSeconds: 120,
    extendSeconds: 25,
    maxExtensions: 10,
  },
};

export const mockAuctionState: AuctionState = {
  sessionId: 1,
  status: 'active',
  product: {
    id: 1,
    name: '测试商品',
    description: '测试商品描述',
    imageUrl: 'https://example.com/img.jpg',
  },
  rule: {
    startPrice: 50,
    bidIncrement: 10,
    ceilingPrice: 500,
    durationSeconds: 60,
    extendSeconds: 20,
    maxExtensions: 10,
  },
  currentPrice: 100,
  leaderboard: [],
  myRank: null,
  remainingMs: 30000,
  startedAt: new Date(Date.now() - 60000).toISOString(),
  participantCount: 5,
  extensionCount: 0,
};

export const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: 1,
    userNickname: '用户A',
    avatarUrl: null,
    amount: 200,
    timestamp: new Date().toISOString(),
    isCurrentUser: false,
  },
  {
    rank: 2,
    userId: 2,
    userNickname: '用户B',
    avatarUrl: 'https://example.com/avatar2.jpg',
    amount: 150,
    timestamp: new Date().toISOString(),
    isCurrentUser: true,
  },
  {
    rank: 3,
    userId: 3,
    userNickname: '用户C',
    avatarUrl: null,
    amount: 120,
    timestamp: new Date().toISOString(),
    isCurrentUser: false,
  },
];

export const mockBidResult: BidResult = {
  sessionId: 1,
  bidId: 101,
  amount: 200,
  rank: 1,
  isLeading: true,
  gapToLeader: 0,
};

export const mockEmotionEvent: EmotionEvent = {
  sessionId: 1,
  userId: 2,
  amount: 200,
  type: 'lead',
};

export const mockCountdownSync: CountdownSync = {
  sessionId: 1,
  remainingMs: 30000,
  serverTime: Date.now(),
};

export const mockChatMessage: ChatMessage = {
  userId: 1,
  userNickname: '用户A',
  avatarUrl: null,
  content: '出价真猛！',
  timestamp: new Date().toISOString(),
};

export const mockMyBids: Record<number, number> = {
  1: 200,
  2: 150,
};

export const mockRoomAuctions: RoomAuctionItem[] = [
  mockRoomAuctionItem,
  mockListedAuction,
  mockEndedAuction,
];
