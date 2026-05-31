import { describe, it, expect } from 'vitest';
import { validateBid } from '../../../src/domain/bid.js';

describe('validateBid', () => {
  const baseCtx = {
    auctionStatus: 'active',
    currentPrice: 0,
    bidIncrement: 10,
    ceilingPrice: null,
    idempotencyKeyExists: false,
    rateLimitExceeded: false,
  };

  it('should pass for valid bid', () => {
    expect(validateBid(1, baseCtx)).toBeNull();
  });

  it('should reject when auction is not active', () => {
    const result = validateBid(1, { ...baseCtx, auctionStatus: 'ended' });
    expect(result).not.toBeNull();
    expect(result!.code).toBe(40900);
  });

  it('should reject duplicate idempotency key', () => {
    const result = validateBid(1, { ...baseCtx, idempotencyKeyExists: true });
    expect(result).not.toBeNull();
    expect(result!.code).toBe(40901);
    expect(result!.message).toContain('重复');
  });

  it('should reject rate limit exceeded', () => {
    const result = validateBid(1, { ...baseCtx, rateLimitExceeded: true });
    expect(result).not.toBeNull();
    expect(result!.code).toBe(42900);
  });

  it('should allow consecutive self-bid', () => {
    expect(validateBid(1, baseCtx)).toBeNull();
  });

  it('should reject when bid exceeds ceiling price', () => {
    const result = validateBid(1, {
      ...baseCtx,
      currentPrice: 495,
      ceilingPrice: 500,
      bidIncrement: 10,
    });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('封顶价');
  });
});
