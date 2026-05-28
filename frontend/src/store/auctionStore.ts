import { create } from 'zustand';
import type { AuctionState, LeaderboardEntry, BidResult, EmotionEvent, CountdownSync, ChatMessage } from '../types/ws';
import type { RoomAuctionItem } from '../types/api';

interface AuctionStore {
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

  setAuction: (auction: AuctionState) => void;
  setLeaderboard: (lb: LeaderboardEntry[]) => void;
  setCountdown: (cd: CountdownSync) => void;
  triggerExtend: (ms: number) => void;
  setBidResult: (result: BidResult) => void;
  setEmotion: (event: EmotionEvent) => void;
  setParticipantCount: (n: number) => void;
  setOnlineCount: (n: number) => void;
  setMyBid: (sessionId: number, amount: number) => void;
  setRoomAuctions: (auctions: RoomAuctionItem[]) => void;
  updateAuctionPrice: (sessionId: number, newPrice: number) => void;
  updateAuctionStatus: (sessionId: number, status: string) => void;
  clearEmotion: () => void;
  clearAuction: () => void;
  addChatMessage: (msg: ChatMessage) => void;
}

export const useAuctionStore = create<AuctionStore>((set) => ({
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

  setAuction: (auction) =>
    set({
      currentAuction: auction,
      leaderboard: auction.leaderboard,
      participantCount: auction.participantCount,
      countdown: auction.remainingMs != null
        ? { sessionId: auction.sessionId, remainingMs: auction.remainingMs, serverTime: Date.now() }
        : null,
    }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setCountdown: (countdown) => set({ countdown }),
  triggerExtend: (extendMs) => set({ extendMs }),
  setBidResult: (result) => set({ myRank: result.rank }),
  setEmotion: (emotionEvent) => set({ emotionEvent }),
  setParticipantCount: (participantCount) => set({ participantCount }),
  setOnlineCount: (onlineCount) => set({ onlineCount }),
  setMyBid: (sessionId, amount) =>
    set((state) => ({ myBids: { ...state.myBids, [sessionId]: amount } })),
  setRoomAuctions: (auctions) => set({ roomAuctions: auctions }),
  updateAuctionPrice: (sessionId, newPrice) =>
    set((state) => ({
      roomAuctions: state.roomAuctions.map((a) =>
        a.sessionId === sessionId ? { ...a, currentPrice: newPrice } : a,
      ),
      currentAuction:
        state.currentAuction?.sessionId === sessionId
          ? { ...state.currentAuction, currentPrice: newPrice }
          : state.currentAuction,
    })),
  updateAuctionStatus: (sessionId, status) =>
    set((state) => ({
      roomAuctions: state.roomAuctions.map((a) =>
        a.sessionId === sessionId ? { ...a, status: status as RoomAuctionItem['status'] } : a,
      ),
      currentAuction:
        state.currentAuction?.sessionId === sessionId
          ? { ...state.currentAuction, status: status as AuctionState['status'] }
          : state.currentAuction,
    })),
  clearEmotion: () => set({ emotionEvent: null }),
  clearAuction: () =>
    set({
      currentAuction: null,
      leaderboard: [],
      countdown: null,
      extendMs: null,
      myRank: null,
      emotionEvent: null,
      participantCount: 0,
      myBids: {},
      roomAuctions: [],
      chatMessages: [],
    }),
  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-99), msg],
    })),
}));
