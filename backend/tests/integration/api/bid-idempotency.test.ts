import { describe, it, expect } from 'vitest';

describe('Bid idempotency', () => {
  it('should reject same idempotency key twice', async () => {
    // This test validates the idempotency pattern in validateBid
    const ctx = {
      auctionStatus: 'active',
      currentPrice: 0,
      bidIncrement: 10,
      ceilingPrice: null,
      idempotencyKeyExists: true,
    };
    const result = (await import('../../../src/domain/bid.js')).validateBid(
      1,
      ctx,
    );
    expect(result).not.toBeNull();
    if (result) expect(result.code).toBe(40901);
  });

  it('should accept first occurrence of idempotency key', async () => {
    const ctx = {
      auctionStatus: 'active',
      currentPrice: 0,
      bidIncrement: 10,
      ceilingPrice: null,
      idempotencyKeyExists: false,
    };
    const result = (await import('../../../src/domain/bid.js')).validateBid(
      1,
      ctx,
    );
    expect(result).toBeNull();
  });
});
