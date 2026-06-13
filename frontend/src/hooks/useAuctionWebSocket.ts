import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useCountdown } from './useCountdown';
import { useAuctionStore } from '../store/auctionStore';
import type { AuctionState, CountdownSync, CountdownExtendEvent, AuctionStartedEvent, AuctionEndResult, LeaderboardEntry } from '../types/ws';

/**
 * Shared hook for auction WebSocket + countdown synchronization.
 * Encapsulates the common pattern used by LiveRoom, ProductList, and AuctionManage:
 * - WebSocket connection to a room
 * - Countdown sync/extend handling
 * - Core auction event subscriptions (auction:state, countdown:sync, countdown:extend, room:count, auction:started, auction:ended, bid:new, rank:update)
 *
 * Additional event subscriptions can be provided via `extraSubscriptions`.
 */
export function useAuctionWebSocket(
  roomId: number | null,
  extraSubscriptions?: (subscribe: ReturnType<typeof useWebSocket>['subscribe']) => (() => void)[],
) {
  const { isConnected, isReconnecting, subscribe, requestState } = useWebSocket(roomId);

  const {
    setAuction,
    setCountdown,
    updateAuctionPrice,
    updateAuctionStatus,
    updateCountdownTick,
    setLeaderboard,
    setOnlineCount,
    setParticipantCount,
    triggerExtend,
  } = useAuctionStore();

  const countdownSync = useAuctionStore((s) => s.countdown);
  const extendMs = useAuctionStore((s) => s.extendMs);
  const countdownRemainingMs = useAuctionStore((s) => s.countdownRemainingMs);
  const countdownIsUrgent = useAuctionStore((s) => s.countdownIsUrgent);

  const { sync, extend } = useCountdown({ onTick: updateCountdownTick });

  // Sync countdown from store
  useEffect(() => {
    if (countdownSync && countdownSync.remainingMs > 0) {
      sync(countdownSync);
    }
  }, [countdownSync, sync]);

  // Handle countdown extension
  useEffect(() => {
    if (extendMs && extendMs.extendMs > 0) {
      extend(extendMs);
      useAuctionStore.setState({ extendMs: null });
    }
  }, [extendMs, extend]);

  // Subscribe to core auction events
  useEffect(() => {
    if (!isConnected || !roomId) return;

    const coreUnsubs = [
      subscribe('auction:state', (data: AuctionState) => {
        if (data.status === 'active') {
          setAuction(data);
          if (data.remainingMs != null) {
            setCountdown({
              sessionId: data.sessionId,
              remainingMs: data.remainingMs,
              serverTime: Date.now(),
            });
          }
        }
      }),
      subscribe('bid:new', (data) => {
        updateAuctionPrice(data.sessionId, data.amount);
      }),
      subscribe('rank:update', (data: LeaderboardEntry[]) => setLeaderboard(data)),
      subscribe('countdown:sync', (data: CountdownSync) => setCountdown(data)),
      subscribe('countdown:extend', (data: CountdownExtendEvent) => {
        triggerExtend({
          sessionId: data.sessionId,
          extendMs: data.extendSeconds * 1000,
          serverTime: data.serverTime ?? Date.now(),
        });
      }),
      subscribe('room:count', (data) => {
        setOnlineCount(data.onlineCount);
        setParticipantCount(data.participantCount);
      }),
      subscribe('auction:started', (data: AuctionStartedEvent) => {
        setAuction({
          sessionId: data.sessionId,
          status: 'active',
          product: data.product,
          rule: data.rule,
          currentPrice: data.currentPrice,
          leaderboard: [],
          myRank: null,
          myBidAmount: null,
          remainingMs: data.rule.durationSeconds * 1000,
          startedAt: data.startedAt,
          participantCount: 0,
          extensionCount: 0,
        });
        if (data.rule.durationSeconds != null) {
          setCountdown({
            sessionId: data.sessionId,
            remainingMs: data.rule.durationSeconds * 1000,
            serverTime: Date.now(),
          });
        }
      }),
      subscribe('auction:ended', (data: AuctionEndResult) => {
        updateAuctionStatus(data.sessionId, data.status);
      }),
    ];

    const extraUnsubs = extraSubscriptions ? extraSubscriptions(subscribe) : [];

    return () => [...coreUnsubs, ...extraUnsubs].forEach((fn) => fn());
  }, [
    isConnected,
    roomId,
    subscribe,
    setAuction,
    setLeaderboard,
    setCountdown,
    triggerExtend,
    setParticipantCount,
    setOnlineCount,
    updateAuctionPrice,
    updateAuctionStatus,
    extraSubscriptions,
  ]);

  return {
    isConnected,
    isReconnecting,
    subscribe,
    requestState,
    countdownRemainingMs,
    countdownIsUrgent,
  };
}
