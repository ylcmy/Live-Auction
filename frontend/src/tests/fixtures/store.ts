import type { AuctionState, LeaderboardEntry, CountdownSync, EmotionEvent, ChatMessage } from '@/types/ws';
import type { RoomAuctionItem, User } from '@/types/api';
import {
  mockAuctionState,
  mockLeaderboard,
  mockCountdownSync,
  mockMyBids,
  mockRoomAuctions,
  mockChatMessage,
} from './auction';

export const mockAuctionStoreState: {
  currentAuction: AuctionState | null;
  leaderboard: LeaderboardEntry[];
  countdown: CountdownSync | null;
  extendMs: number | null;
  myRank: number | null;
  emotionEvent: EmotionEvent | null;
  participantCount: number;
  onlineCount: number;
  myBids: Record<number, number>;
  roomAuctions: RoomAuctionItem[];
  chatMessages: ChatMessage[];
} = {
  currentAuction: mockAuctionState,
  leaderboard: mockLeaderboard,
  countdown: mockCountdownSync,
  extendMs: null,
  myRank: 2,
  emotionEvent: null,
  participantCount: 5,
  onlineCount: 42,
  myBids: mockMyBids,
  roomAuctions: mockRoomAuctions,
  chatMessages: [mockChatMessage],
};

export const mockAuctionStoreStateEmpty: typeof mockAuctionStoreState = {
  currentAuction: null,
  leaderboard: [],
  countdown: null,
  extendMs: null,
  myRank: null,
  emotionEvent: null,
  participantCount: 0,
  onlineCount: 0,
  myBids: {},
  roomAuctions: [],
  chatMessages: [],
};

export const mockUser: User = {
  id: 1,
  username: 'testuser',
  nickname: '测试用户',
  role: 'user',
  avatarUrl: null,
};

export const mockMerchantUser: User = {
  id: 2,
  username: 'merchant',
  nickname: '测试商家',
  role: 'merchant',
  avatarUrl: 'https://example.com/merchant-avatar.jpg',
};

export const mockAuthStoreState: {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
} = {
  user: mockUser,
  token: 'mock_access_token',
  isLoading: false,
  error: null,
};

export const mockAuthStoreStateUnauthenticated: typeof mockAuthStoreState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
};
