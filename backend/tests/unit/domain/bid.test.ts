import { describe, it, expect } from 'vitest';
import { validateBid } from '../../../src/domain/bid.js';

describe('validateBid', () => {
  const baseCtx = {
    auctionStatus: 'active',
    currentPrice: 0,
    bidIncrement: 10,
    ceilingPrice: null,
    lastBidUserId: null,
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

  it('should reject consecutive self-bid', () => {
    const result = validateBid(1, { ...baseCtx, lastBidUserId: 1 });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('等待他人');
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

describe('validateBid - extended boundary tests', () => {
  const baseCtx = {
    auctionStatus: 'active',
    currentPrice: 0,
    bidIncrement: 10,
    ceilingPrice: null,
    lastBidUserId: null,
    idempotencyKeyExists: false,
    rateLimitExceeded: false,
  };

  // ─── self-bid prevention ───────────────────────────────────────────────────

  it('should reject when user is the current highest bidder (self-bid)', () => {
    const result = validateBid(42, { ...baseCtx, lastBidUserId: 42 });
    expect(result).not.toBeNull();
    expect(result!.code).toBe(40901);
    expect(result!.message).toContain('等待他人');
  });

  it('should pass when user is NOT the current highest bidder', () => {
    const result = validateBid(42, { ...baseCtx, lastBidUserId: 99 });
    expect(result).toBeNull();
  });

  it('should pass when lastBidUserId is null (first bid scenario)', () => {
    const result = validateBid(42, { ...baseCtx, lastBidUserId: null });
    expect(result).toBeNull();
  });

  // ─── rate limit ────────────────────────────────────────────────────────────

  it('should reject when rate limit is exceeded', () => {
    const result = validateBid(1, { ...baseCtx, rateLimitExceeded: true });
    expect(result).not.toBeNull();
    expect(result!.code).toBe(42900);
  });

  it('should pass when rate limit is not exceeded', () => {
    const result = validateBid(1, { ...baseCtx, rateLimitExceeded: false });
    expect(result).toBeNull();
  });

  // ─── null ceiling price ────────────────────────────────────────────────────

  it('should pass when ceilingPrice is null (no ceiling restriction)', () => {
    const ctx = {
      ...baseCtx,
      currentPrice: 10000,
      bidIncrement: 1000,
      ceilingPrice: null,
    };
    expect(validateBid(1, ctx)).toBeNull();
  });

  it('should pass when ceilingPrice is null even with large values', () => {
    const ctx = {
      ...baseCtx,
      currentPrice: Number.MAX_SAFE_INTEGER - 1,
      bidIncrement: 1,
      ceilingPrice: null,
    };
    expect(validateBid(1, ctx)).toBeNull();
  });

  // ─── exact minimum valid bid (amount = currentPrice + increment) ───────────

  it('should pass when nextBid equals ceilingPrice exactly (not exceeding)', () => {
    // nextBid = 490 + 10 = 500, ceiling = 500, 500 > 500 is false → pass
    const ctx = {
      ...baseCtx,
      currentPrice: 490,
      bidIncrement: 10,
      ceilingPrice: 500,
    };
    expect(validateBid(1, ctx)).toBeNull();
  });

  it('should reject when nextBid exceeds ceilingPrice by 1', () => {
    // nextBid = 491 + 10 = 501, ceiling = 500, 501 > 500 → reject
    const ctx = {
      ...baseCtx,
      currentPrice: 491,
      bidIncrement: 10,
      ceilingPrice: 500,
    };
    const result = validateBid(1, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('封顶价');
  });

  // ─── userId 为空/undefined ──────────────────────────────────────────────────

  it('should handle userId of 0 (falsy but valid number)', () => {
    const result = validateBid(0, baseCtx);
    // userId 0 is falsy but the function only checks lastBidUserId equality
    expect(result).toBeNull();
  });

  it('should handle negative userId', () => {
    const result = validateBid(-1, baseCtx);
    // No userId format validation exists, so it passes basic checks
    expect(result).toBeNull();
  });

  it('should reject when lastBidUserId is 0 and userId is also 0', () => {
    const result = validateBid(0, { ...baseCtx, lastBidUserId: 0 });
    expect(result).not.toBeNull();
    expect(result!.code).toBe(40901);
  });

  // ─── combined edge cases ───────────────────────────────────────────────────

  it('should check idempotency before self-bid (idempotency takes priority)', () => {
    const result = validateBid(1, {
      ...baseCtx,
      lastBidUserId: 1,
      idempotencyKeyExists: true,
    });
    // idempotency check comes before self-bid check in the code
    expect(result).not.toBeNull();
    expect(result!.code).toBe(40901);
    expect(result!.message).toContain('重复');
  });

  it('should check auctionStatus first before all other checks', () => {
    const result = validateBid(1, {
      ...baseCtx,
      auctionStatus: 'ended',
      idempotencyKeyExists: true,
      rateLimitExceeded: true,
      lastBidUserId: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.code).toBe(40900);
  });

  it('should handle ceilingPrice of 0 (always exceeds)', () => {
    // nextBid = 0 + 10 = 10, 10 > 0 → reject
    const ctx = { ...baseCtx, currentPrice: 0, bidIncrement: 10, ceilingPrice: 0 };
    const result = validateBid(1, ctx);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('封顶价');
  });
});
