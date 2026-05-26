import { create } from 'zustand';
export const useAuctionStore = create((set) => ({
    currentAuction: null,
    leaderboard: [],
    countdown: null,
    myRank: null,
    emotionEvent: null,
    participantCount: 0,
    onlineCount: 0,
    setAuction: (auction) => set({
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
    clearAuction: () => set({
        currentAuction: null,
        leaderboard: [],
        countdown: null,
        myRank: null,
        emotionEvent: null,
        participantCount: 0,
    }),
}));
