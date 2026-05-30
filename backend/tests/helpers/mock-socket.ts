import { vi } from 'vitest';

/**
 * Creates a mock Socket.IO Socket object for testing WebSocket handlers.
 *
 * Usage:
 *   const { socket, handlers } = createMockSocket({ userId: 1 });
 *   registerBidHandlers(mockIO, socket as unknown as Socket);
 *   const bidHandler = handlers.get('bid:submit');
 *   await bidHandler?.({ sessionId: 1, idempotencyKey: 'key' });
 */
export function createMockSocket(overrides?: Record<string, unknown>) {
  const handlers = new Map<string, (...args: unknown[]) => void>();

  const socket = {
    id: `socket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    data: {},
    // Cast to allow setting userId via (socket as any).userId in handlers
    userId: 1,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    off: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
    ...overrides,
  };

  return { socket, handlers };
}

export type MockSocket = ReturnType<typeof createMockSocket>['socket'];

/**
 * Creates a mock Socket.IO Server object for testing.
 *
 * Tracks rooms and provides `to`/`in` methods that return chainable emitters.
 */
export function createMockIO() {
  const rooms = new Map<string, Set<string>>();

  const createEmitter = () => ({ emit: vi.fn() });

  return {
    to: vi.fn(() => createEmitter()),
    in: vi.fn(() => createEmitter()),
    emit: vi.fn(),
    on: vi.fn(),
    socketsJoin: vi.fn(async (roomId: string, socketId: string) => {
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId)!.add(socketId);
    }),
    socketsLeave: vi.fn(async (roomId: string, socketId: string) => {
      rooms.get(roomId)?.delete(socketId);
    }),
    fetchSockets: vi.fn(async () => []),
    // ---- Test helpers ----
    _rooms: rooms,
  };
}

export type MockIO = ReturnType<typeof createMockIO>;
