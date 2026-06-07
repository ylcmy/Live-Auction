import { describe, it, expect } from 'vitest';
import { validateBid } from '../../../src/domain/bid.js';

describe('Auction settlement flow (unit)', () => {
  it('should validate bid cannot proceed on ended auction', () => {
    const ctx = {
      auctionStatus: 'ended',
      currentPrice: 100,
      bidIncrement: 10,
      ceilingPrice: null,
      idempotencyKeyExists: false,
      rateLimitExceeded: false,
    };
    expect(validateBid(1, ctx)?.code).toBe(40900);
  });

  it('should validate bid cannot proceed on cancelled auction', () => {
    const ctx = {
      auctionStatus: 'cancelled',
      currentPrice: 100,
      bidIncrement: 10,
      ceilingPrice: null,
      idempotencyKeyExists: false,
      rateLimitExceeded: false,
    };
    expect(validateBid(1, ctx)?.code).toBe(40900);
  });
});
