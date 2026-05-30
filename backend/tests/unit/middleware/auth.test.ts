import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn() },
  verify: vi.fn(),
}));

vi.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-secret' },
}));

import jwt from 'jsonwebtoken';
import { authMiddleware, requireRole } from '../../../src/middleware/auth.js';

const mockedVerify = vi.mocked(jwt.verify);

function createMockRequest(authorization?: string) {
  return {
    headers: authorization !== undefined ? { authorization } : {},
    auth: undefined as any,
  } as any;
}

function createMockReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set req.auth when JWT is valid', async () => {
    // Arrange
    const payload = { userId: 1, role: 'merchant' as const };
    mockedVerify.mockReturnValueOnce(payload as any);
    const req = createMockRequest('Bearer valid-token');
    const reply = createMockReply();

    // Act
    await authMiddleware(req, reply);

    // Assert
    expect(mockedVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
    expect(req.auth).toEqual(payload);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('should return 401 when JWT is expired', async () => {
    // Arrange
    mockedVerify.mockImplementationOnce(() => {
      throw new Error('jwt expired');
    });
    const req = createMockRequest('Bearer expired-token');
    const reply = createMockReply();

    // Act
    await authMiddleware(req, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(401);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(40100);
    expect(body.message).toBe('令牌无效或已过期');
    expect(body.data).toBeNull();
  });

  it('should return 401 when Authorization header is missing', async () => {
    // Arrange
    const req = createMockRequest();
    const reply = createMockReply();

    // Act
    await authMiddleware(req, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(401);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(40100);
    expect(body.message).toBe('未认证');
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header lacks Bearer prefix', async () => {
    // Arrange
    const req = createMockRequest('Token abc');
    const reply = createMockReply();

    // Act
    await authMiddleware(req, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(401);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(40100);
    expect(body.message).toBe('未认证');
    expect(mockedVerify).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('should pass when user has the required role', async () => {
    // Arrange
    const req = { auth: { userId: 1, role: 'merchant' } } as any;
    const reply = createMockReply();

    // Act
    const handler = requireRole('merchant');
    await handler(req, reply);

    // Assert
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks the required role', async () => {
    // Arrange
    const req = { auth: { userId: 2, role: 'user' } } as any;
    const reply = createMockReply();

    // Act
    const handler = requireRole('merchant');
    await handler(req, reply);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(403);
    const body = reply.send.mock.calls[0][0];
    expect(body.code).toBe(40300);
    expect(body.message).toBe('无权限');
  });
});
