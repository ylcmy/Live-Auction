import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replySuccess, replyError } from '../../../src/lib/reply.js';
import type { FastifyReply } from 'fastify';

function createMockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply;
}

describe('replySuccess', () => {
  let reply: FastifyReply;

  beforeEach(() => {
    reply = createMockReply();
  });

  it('should return code=0, message="ok", data, and timestamp', () => {
    // Arrange
    const data = { id: 1, name: 'item' };

    // Act
    replySuccess(reply, data);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledTimes(1);

    const payload = (reply.send as any).mock.calls[0][0];
    expect(payload.code).toBe(0);
    expect(payload.message).toBe('ok');
    expect(payload.data).toEqual(data);
    expect(typeof payload.timestamp).toBe('number');
  });

  it('should use custom statusCode when provided', () => {
    // Arrange & Act
    replySuccess(reply, null, 201);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(201);
  });

  it('should default statusCode to 200', () => {
    // Arrange & Act
    replySuccess(reply, 'ok');

    // Assert
    expect(reply.code).toHaveBeenCalledWith(200);
  });

  it('should pass data as null when null is provided', () => {
    // Arrange & Act
    replySuccess(reply, null);

    // Assert
    const payload = (reply.send as any).mock.calls[0][0];
    expect(payload.data).toBeNull();
  });
});

describe('replyError', () => {
  let reply: FastifyReply;

  beforeEach(() => {
    reply = createMockReply();
  });

  it('should return correct code, message, data=null, and timestamp', () => {
    // Arrange & Act
    replyError(reply, 40001, 'validation failed');

    // Assert
    expect(reply.code).toHaveBeenCalledWith(400);

    const payload = (reply.send as any).mock.calls[0][0];
    expect(payload.code).toBe(40001);
    expect(payload.message).toBe('validation failed');
    expect(payload.data).toBeNull();
    expect(typeof payload.timestamp).toBe('number');
  });

  it('should use custom statusCode when provided', () => {
    // Arrange & Act
    replyError(reply, 50000, 'internal error', 500);

    // Assert
    expect(reply.code).toHaveBeenCalledWith(500);
  });

  it('should default statusCode to 400', () => {
    // Arrange & Act
    replyError(reply, 40000, 'bad request');

    // Assert
    expect(reply.code).toHaveBeenCalledWith(400);
  });
});
