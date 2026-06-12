import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, getSocket, refreshAndReconnect } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { decodeJwtPayload } from '../lib/jwt';
import type { WsEvents } from '../types/ws';

// Reference-counting map for joined rooms to prevent duplicate joins across components
const joinedRoomCounts = new Map<number, number>();

// Subscription registry to re-attach handlers after reconnect
const subscriptionRegistry = new Map<number, Set<{ event: string; handler: (...args: any[]) => void }>>();

export function useWebSocket(roomId: number | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);
  const myRoomRef = useRef<number | null>(null);

  // Re-join room and request full state (used on reconnect and manually)
  const requestState = useCallback(() => {
    const currentSocket = socketRef.current || getSocket();
    if (currentSocket && myRoomRef.current !== null) {
      currentSocket.emit('auction:join', { roomId: myRoomRef.current });
    }
  }, []);

  useEffect(() => {
    if (!token || !roomId) {
      // Sync disconnect state when roomId becomes null
      setIsConnected(false);
      setIsReconnecting(false);
      return;
    }

    const socket = connectSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };
    const onDisconnect = () => {
      setIsConnected(false);
    };
    const onReconnectAttempt = async () => {
      setIsReconnecting(true);
      // Check if the current token is expired and try to refresh before reconnecting
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        const payload = decodeJwtPayload<{ exp: number }>(currentToken);
        if (payload?.exp && payload.exp * 1000 < Date.now()) {
          const refreshed = await refreshAndReconnect();
          if (refreshed) {
            // Update the auth store with the new token
            const newToken = localStorage.getItem('accessToken');
            if (newToken) {
              useAuthStore.setState({ token: newToken });
            }
          } else {
            // Refresh failed — token expired, redirect to login
            useAuthStore.getState().logout();
            window.location.href = '/login';
          }
        }
      }
    };
    const onReconnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      // Re-join room to trigger full state recovery from server.
      // Server will respond with 'auction:state' if there's an active session,
      // even if Redis cache was lost (falls back to MySQL).
      requestState();

      // Re-attach all subscriptions to the new socket
      const newSocket = socketRef.current || getSocket();
      if (newSocket && roomId) {
        const subs = subscriptionRegistry.get(roomId);
        if (subs) {
          for (const { event, handler } of subs) {
            newSocket.on(event, handler as (...args: any[]) => void);
          }
        }
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect', onReconnect);

    // Reference-counted join: only emit auction:join when count goes from 0 to 1
    const count = joinedRoomCounts.get(roomId) || 0;
    if (count === 0) {
      socket.emit('auction:join', { roomId });
    }
    joinedRoomCounts.set(roomId, count + 1);
    myRoomRef.current = roomId;

    // If socket is already connected (e.g., shared from another page),
    // sync state immediately since the 'connect' event already fired.
    if (socket.connected) {
      onConnect();
    }

    // Listen for browser online/offline events to detect disconnection immediately
    // (Socket.IO heartbeat can take 25+ seconds to detect a broken connection)
    const onBrowserOffline = () => {
      setIsConnected(false);
      setIsReconnecting(true);
      // Force disconnect so Socket.IO knows it's disconnected.
      // Without this, socket.connected remains true until heartbeat timeout (25s+),
      // preventing onBrowserOnline from triggering reconnect.
      const currentSocket = socketRef.current || getSocket();
      if (currentSocket) {
        currentSocket.disconnect();
      }
    };
    const onBrowserOnline = () => {
      // Browser is back online; force Socket.IO to reconnect immediately
      // rather than waiting for its internal heartbeat detection.
      const currentSocket = socketRef.current || getSocket();
      if (currentSocket && !currentSocket.connected) {
        currentSocket.connect();
      }
    };

    window.addEventListener('offline', onBrowserOffline);
    window.addEventListener('online', onBrowserOnline);

    return () => {
      if (myRoomRef.current === roomId) {
        // Reference-counted leave: only emit auction:leave when count reaches 0
        const currentCount = joinedRoomCounts.get(roomId) || 0;
        if (currentCount <= 1) {
          socket.emit('auction:leave', { roomId });
          joinedRoomCounts.delete(roomId);
        } else {
          joinedRoomCounts.set(roomId, currentCount - 1);
        }
        myRoomRef.current = null;
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('reconnect', onReconnect);
      window.removeEventListener('offline', onBrowserOffline);
      window.removeEventListener('online', onBrowserOnline);
      // Don't disconnect - socket shared across components
    };
  }, [token, roomId, requestState]);

  const subscribe = useCallback(<K extends keyof WsEvents>(
    event: K,
    handler: (data: WsEvents[K]) => void,
  ) => {
    const onEvent = (data: WsEvents[K]) => handler(data);

    // Register in the subscription registry
    const currentRoomId = myRoomRef.current;
    if (currentRoomId) {
      if (!subscriptionRegistry.has(currentRoomId)) {
        subscriptionRegistry.set(currentRoomId, new Set());
      }
      subscriptionRegistry.get(currentRoomId)!.add({ event, handler: onEvent as (...args: any[]) => void });
    }

    // Attach to current socket
    const currentSocket = socketRef.current || getSocket();
    currentSocket?.on(event as string, onEvent as (...args: any[]) => void);

    return () => {
      const s = socketRef.current || getSocket();
      s?.off(event as string, onEvent as (...args: any[]) => void);
      // Remove from registry
      if (currentRoomId && subscriptionRegistry.has(currentRoomId)) {
        const subs = subscriptionRegistry.get(currentRoomId)!;
        for (const sub of subs) {
          if (sub.event === event && sub.handler === onEvent) {
            subs.delete(sub);
            break;
          }
        }
      }
    };
  }, []);

  return { socket: socketRef.current, isConnected, isReconnecting, subscribe, requestState };
}
