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

  useEffect(() => {
    if (!token || !roomId) return;

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
      if (myRoomRef.current !== null) {
        socket.emit('auction:join', { roomId: myRoomRef.current });
      }
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
      // Don't disconnect - socket shared across components
    };
  }, [token, roomId]);

  const subscribe = useCallback(<T>(event: string, handler: (data: T) => void) => {
    // Use the shared socket instance directly to avoid stale ref issues
    const currentSocket = socketRef.current || getSocket();
    currentSocket?.on(event, handler);
    return () => {
      currentSocket?.off(event, handler);
    };
  }, []);

  return { socket: socketRef.current, isConnected, isReconnecting, subscribe };
}
