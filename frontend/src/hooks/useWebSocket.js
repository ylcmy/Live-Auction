import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
export function useWebSocket(roomId) {
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const token = useAuthStore((s) => s.token);
    const socketRef = useRef(null);
    useEffect(() => {
        if (!token || !roomId)
            return;
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
        };
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('reconnect_attempt', onReconnectAttempt);
        socket.on('reconnect', onReconnect);
        // Join room
        socket.emit('auction:join', { roomId });
        return () => {
            socket.emit('auction:leave', { roomId });
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('reconnect_attempt', onReconnectAttempt);
            socket.off('reconnect', onReconnect);
            // Don't disconnect - socket shared across components
        };
    }, [token, roomId]);
    const subscribe = useCallback((event, handler) => {
        socketRef.current?.on(event, handler);
        return () => {
            socketRef.current?.off(event, handler);
        };
    }, []);
    return { socket: socketRef.current, isConnected, isReconnecting, subscribe };
}
