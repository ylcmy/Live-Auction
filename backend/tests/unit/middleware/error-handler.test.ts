import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/middleware/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { registerErrorHandler } from '../../../src/middleware/errorHandler.js';
import { AppError } from '../../../src/lib/app-error.js';

function captureErrorHandler() {
  let handler: (error: any, request: any, reply: any) => void;
  const app = {
    setErrorHandler: vi.fn((fn: any) => {
      handler = fn;
    }),
  };
  registerErrorHandler(app as any);
  return handler!;
}

function createMockReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
}

const mockRequest = { url: '/test' } as any;

describe('registerErrorHandler', () => {
  let handler: (error: any, request: any, reply: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = captureErrorHandler();
  });

  it('should use AppError statusCode and code', () => {
    // Arrange
    const error = new AppError('资源不存在', 404);
    const reply = createMockReply();

    // Act
    handler(error, mockRequest, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(404);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(40400);
    expect(body.message).toBe('资源不存在');
    expect(body.data).toBeNull();
    expect(typeof body.timestamp).toBe('number');
  });

  it('should return 500 for a generic Error', () => {
    // Arrange
    const error = new Error('unexpected failure');
    const reply = createMockReply();

    // Act
    handler(error, mockRequest, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(500);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(50000);
    expect(body.data).toBeNull();
  });

  it('should hide internal message for 5xx errors', () => {
    // Arrange
    const error = new Error('db connection string leaked');
    const reply = createMockReply();

    // Act
    handler(error, mockRequest, reply);

    // Assert
    const body = reply.send.mock.calls[0][0];
    expect(body.message).toBe('服务器内部错误');
    expect(body.message).not.toContain('db connection string');
  });

  it('should preserve original message for 4xx errors', () => {
    // Arrange
    const error = new AppError('用户名已被注册', 409);
    const reply = createMockReply();

    // Act
    handler(error, mockRequest, reply);

    // Assert
    const body = reply.send.mock.calls[0][0];
    expect(reply.code).toHaveBeenCalledWith(409);
    expect(body.code).toBe(40900);
    expect(body.message).toBe('用户名已被注册');
  });

  it('should default to 500 when error has no statusCode', () => {
    // Arrange
    const error = new Error('no status');
    const reply = createMockReply();

    // Act
    handler(error, mockRequest, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(500);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(50000);
  });

  it('should compute code as statusCode * 100 for 4xx non-AppError', () => {
    // Arrange
    const error: any = new Error('validation failed');
    error.statusCode = 422;
    const reply = createMockReply();

    // Act
    handler(error, mockRequest, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(422);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(42200);
    expect(body.message).toBe('validation failed');
  });
});
