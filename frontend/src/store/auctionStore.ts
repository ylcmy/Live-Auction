import { create } from 'zustand';
import type { AuctionState, LeaderboardEntry, BidResult, EmotionEvent, CountdownSync } from '../types/ws';

interface AuctionStore {
  currentAuction: AuctionState | null;
  leaderboard: LeaderboardEntry[];
  countdown: CountdownSync | null;
  myRank: number | null;
  emotionEvent: EmotionEvent | null;
  participantCount: number;
  onlineCount: number;

  setAuction: (auction: AuctionState) => void;
  setLeaderboard: (lb: LeaderboardEntry[]) => void;
  setCountdown: (cd: CountdownSync) => void;
  setBidResult: (result: BidResult) => void;
  setEmotion: (event: EmotionEvent) => void;
  setParticipantCount: (n: number) => void;
  setOnlineCount: (n: number) => void;
  clearAuction: () => void;
}

export const useAuctionStore = create<AuctionStore>((set) => ({
  currentAuction: null,
  leaderboard: [],
  countdown: null,
  myRank: null,
  emotionEvent: null,
  participantCount: 0,
  onlineCount: 0,

  setAuction: (auction) =>
    set({
      currentAuction: auction,
      leaderboard: auction.leaderboard,
      participantCount: auction.participantCount,
    }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setCountdown: (countdown) => set({ countdown }),
  setBidResult: (result) => set({ myRank: result.rank }),
  setEmotion: (emotionEvent) => set({ emotionEvent }),
  setParticipantCount: (participantCount) => set({ participantCount }),
  setOnlineCount: (onlineCount) => set({ onlineCount }),
  clearAuction: () =>
    set({
      currentAuction: null,
      leaderboard: [],
      countdown: null,
      myRank: null,
      emotionEvent: null,
      participantCount: 0,
    }),
}));
