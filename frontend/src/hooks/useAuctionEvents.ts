import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import type { BidResult, AuctionEndResult } from '../types/ws';

interface AuctionEventHandlers {
  onBidAccepted?: (data: BidResult) => void;
  onBidNew?: (data: { sessionId: number; amount: number; newTopBid: boolean }) => void;
  onAuctionEnded?: (data: AuctionEndResult) => void;
}

/**
 * Unified hook for managing WebSocket event subscriptions within an auction session.
 * Handles socket acquisition, sessionId filtering, and event registration/cleanup.
 * Uses a ref for handlers so they always have access to the latest closures
 * without triggering re-subscriptions.
 */
export function useAuctionEvents(
  sessionId: number | null,
  enabled: boolean,
  handlers: AuctionEventHandlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const socket = getSocket();
    if (!socket) return;

    // Wrap handler to filter by sessionId and read from ref for latest closure
    const createHandler = <T extends { sessionId: number }>(
      handlerGetter: () => ((data: T) => void) | undefined,
    ) => {
      return (data: T) => {
        if (data.sessionId === sessionId) {
          handlerGetter()?.(data);
        }
      };
    };

    const registrations: Array<[string, (...args: unknown[]) => void]> = [];

    const bidAcceptedHandler = createHandler(() => handlersRef.current.onBidAccepted);
    socket.on('bid:accepted', bidAcceptedHandler as (...args: unknown[]) => void);
    registrations.push(['bid:accepted', bidAcceptedHandler as (...args: unknown[]) => void]);

    const bidNewHandler = createHandler(() => handlersRef.current.onBidNew);
    socket.on('bid:new', bidNewHandler as (...args: unknown[]) => void);
    registrations.push(['bid:new', bidNewHandler as (...args: unknown[]) => void]);

    const auctionEndedHandler = createHandler(() => handlersRef.current.onAuctionEnded);
    socket.on('auction:ended', auctionEndedHandler as (...args: unknown[]) => void);
    registrations.push(['auction:ended', auctionEndedHandler as (...args: unknown[]) => void]);

    return () => {
      for (const [event, handler] of registrations) {
        socket.off(event, handler);
      }
    };
  }, [sessionId, enabled]);
}
