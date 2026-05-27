export interface AuctionState {
  sessionId: number;
  status: 'pending' | 'active' | 'ended' | 'cancelled';
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
  isCurrentUser: boolean;
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
}

export interface CountdownSync {
  sessionId: number;
  remainingMs: number;
  serverTime: number;
}

export interface EmotionEvent {
  sessionId: number;
  userId?: number;
  amount?: number;
  type: 'lead' | 'overtaken' | 'extended' | 'ended' | 'cancelled';
  extendSeconds?: number;
}
