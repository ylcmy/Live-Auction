import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';

// Track joined rooms globally to prevent duplicate joins
const joinedRooms = new Set<number>();

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
    const onReconnectAttempt = () => setIsReconnecting(true);
    const onReconnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      // Re-join room to trigger full state recovery from server.
      // Server will respond with 'auction:state' if there's an active session,
      // even if Redis cache was lost (falls back to MySQL).
      requestState();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect', onReconnect);

    if (!joinedRooms.has(roomId)) {
      socket.emit('auction:join', { roomId });
      joinedRooms.add(roomId);
    }
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
        socket.emit('auction:leave', { roomId });
        joinedRooms.delete(roomId);
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

  const subscribe = useCallback(<T>(event: string, handler: (data: T) => void) => {
    // Use the shared socket instance directly to avoid stale ref issues
    const currentSocket = socketRef.current || getSocket();
    currentSocket?.on(event, handler);
    return () => {
      currentSocket?.off(event, handler);
    };
  }, []);

  return { socket: socketRef.current, isConnected, isReconnecting, subscribe, requestState };
}
