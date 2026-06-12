import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect(); // Clean up stale disconnected socket

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => console.log('WS connected:', socket?.id));
  socket.on('disconnect', (reason) => console.log('WS disconnected:', reason));
  socket.on('connect_error', (err) => console.error('WS connect error:', err.message));

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Refresh the JWT token and update the socket auth for reconnection.
 * Called when a reconnect_attempt detects an expired token.
 *
 * @returns true if refresh succeeded, false if refresh failed (caller should redirect to login)
 */
export async function refreshAndReconnect(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const json = await response.json();
    const newToken = json.data?.accessToken;
    if (!newToken) return false;

    // Update stored token
    localStorage.setItem('accessToken', newToken);

    // Update socket auth token for next reconnection attempt
    if (socket) {
      socket.auth = { token: newToken };
    }

    return true;
  } catch {
    return false;
  }
}
