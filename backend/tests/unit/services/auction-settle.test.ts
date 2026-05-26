import { describe, it, expect } from 'vitest';
import { checkCeilingPrice } from '../../../src/domain/auction.js';
import { validateBid } from '../../../src/domain/bid.js';

describe('Auction settlement flow (unit)', () => {
  it('should detect ceiling price trigger', () => {
    expect(checkCeilingPrice(490, 10, 500)).toBe(true);
    expect(checkCeilingPrice(489, 10, 500)).toBe(false);
  });

  it('should validate bid cannot proceed on ended auction', () => {
    const ctx = {
      auctionStatus: 'ended',
      currentPrice: 100,
      bidIncrement: 10,
      ceilingPrice: null,
      lastBidUserId: null,
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
      lastBidUserId: null,
      idempotencyKeyExists: false,
      rateLimitExceeded: false,
    };
    expect(validateBid(1, ctx)?.code).toBe(40900);
  });
});
