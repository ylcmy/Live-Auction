import { vi } from 'vitest';

export function createMockSocket() {
  const listeners: Record<string, Function[]> = {};

  return {
    id: 'mock_socket_id',
    connected: true,
    disconnected: false,
    emit: vi.fn(),
    on: vi.fn((event: string, callback: Function) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }),
    off: vi.fn((event: string, callback?: Function) => {
      if (callback) {
        listeners[event] = (listeners[event] || []).filter((fn) => fn !== callback);
      } else {
        delete listeners[event];
      }
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

export const mockSocket = createMockSocket();

export function setupSocketMock() {
  vi.mock('@/services/socket', () => ({
    connectSocket: vi.fn(() => mockSocket),
    getSocket: vi.fn(() => mockSocket),
    disconnectSocket: vi.fn(),
  }));
}
