import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock socket.io-client
const mockSocketInstance = {
  id: 'mock_socket_id',
  connected: false,
  disconnected: true,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};

const ioMock = vi.fn(() => mockSocketInstance);
vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

describe('socket service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module to clear singleton state
    vi.resetModules();
    mockSocketInstance.connected = false;
    mockSocketInstance.disconnected = true;
  });

  describe('connectSocket', () => {
    test('使用正确参数创建 socket.io 连接', async () => {
      const { connectSocket } = await import('@/services/socket');

      connectSocket('test-token');

      expect(ioMock).toHaveBeenCalledWith('/', {
        auth: { token: 'test-token' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
    });

    test('注册 connect、disconnect 和 connect_error 事件监听', async () => {
      const { connectSocket } = await import('@/services/socket');

      connectSocket('test-token');

      expect(mockSocketInstance.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
      expect(mockSocketInstance.on).toHaveBeenCalledWith(
        'disconnect',
        expect.any(Function),
      );
      expect(mockSocketInstance.on).toHaveBeenCalledWith(
        'connect_error',
        expect.any(Function),
      );
    });

    test('返回 socket 实例', async () => {
      const { connectSocket } = await import('@/services/socket');

      const socket = connectSocket('test-token');

      expect(socket).toBe(mockSocketInstance);
    });

    test('socket 已连接时返回现有实例而不重新创建', async () => {
      const { connectSocket } = await import('@/services/socket');

      mockSocketInstance.connected = true;

      const socket1 = connectSocket('token-1');
      const socket2 = connectSocket('token-2');

      expect(ioMock).toHaveBeenCalledTimes(1);
      expect(socket1).toBe(socket2);
    });
  });

  describe('getSocket', () => {
    test('未连接时返回 null', async () => {
      const { getSocket } = await import('@/services/socket');

      expect(getSocket()).toBeNull();
    });

    test('连接后返回 socket 实例', async () => {
      const { connectSocket, getSocket } = await import('@/services/socket');

      const socket = connectSocket('test-token');

      expect(getSocket()).toBe(socket);
    });
  });

  describe('disconnectSocket', () => {
    test('断开连接并清除 socket 引用', async () => {
      const { connectSocket, disconnectSocket, getSocket } = await import(
        '@/services/socket'
      );

      connectSocket('test-token');
      expect(getSocket()).not.toBeNull();

      disconnectSocket();

      expect(mockSocketInstance.disconnect).toHaveBeenCalledTimes(1);
      expect(getSocket()).toBeNull();
    });

    test('未连接时调用 disconnectSocket 不抛错', async () => {
      const { disconnectSocket } = await import('@/services/socket');

      expect(() => disconnectSocket()).not.toThrow();
      expect(mockSocketInstance.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('重连配置', () => {
    test('配置 5 次重连尝试', async () => {
      const { connectSocket } = await import('@/services/socket');

      connectSocket('test-token');

      const config = ioMock.mock.calls[0][1];
      expect(config.reconnectionAttempts).toBe(5);
    });

    test('基础重连延迟为 1 秒', async () => {
      const { connectSocket } = await import('@/services/socket');

      connectSocket('test-token');

      const config = ioMock.mock.calls[0][1];
      expect(config.reconnectionDelay).toBe(1000);
    });

    test('最大重连延迟为 10 秒', async () => {
      const { connectSocket } = await import('@/services/socket');

      connectSocket('test-token');

      const config = ioMock.mock.calls[0][1];
      expect(config.reconnectionDelayMax).toBe(10000);
    });

    test('启用了自动重连', async () => {
      const { connectSocket } = await import('@/services/socket');

      connectSocket('test-token');

      const config = ioMock.mock.calls[0][1];
      expect(config.reconnection).toBe(true);
    });
  });
});
