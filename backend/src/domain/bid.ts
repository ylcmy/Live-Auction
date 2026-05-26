/**
 * T062: Bid validation rules (PURE functions, NO I/O)
 *
 * Domain-level validation for bid operations. These functions are
 * side-effect-free and can be tested in isolation without any infrastructure.
 */

export interface BidValidationContext {
  auctionStatus: string;
  currentPrice: number;
  bidIncrement: number;
  ceilingPrice: number | null;
  lastBidUserId: number | null; // userId of last bidder
  idempotencyKeyExists: boolean;
  rateLimitExceeded: boolean;
}

export interface BidValidationError {
  code: number;
  message: string;
}

/**
 * Validate a bid against all business rules.
 * Returns null if the bid is valid, or a BidValidationError if rejected.
 */
export function validateBid(
  userId: number,
  context: BidValidationContext,
): BidValidationError | null {
  // Auction must be active
  if (context.auctionStatus !== 'active') {
    return { code: 40900, message: '竞拍已结束或未开始' };
  }

  // Idempotency key already used
  if (context.idempotencyKeyExists) {
    return { code: 40901, message: '重复的出价请求' };
  }

  // Rate limit exceeded
  if (context.rateLimitExceeded) {
    return { code: 42900, message: '出价过于频繁，请稍后再试' };
  }

  // Cannot bid consecutively (same user as last bid)
  if (context.lastBidUserId === userId) {
    return { code: 40901, message: '请等待他人出价后再出' };
  }

  // Ceiling price check
  if (context.ceilingPrice !== null && context.ceilingPrice !== undefined) {
    const nextBid = context.currentPrice + context.bidIncrement;
    if (nextBid > context.ceilingPrice) {
      return { code: 40901, message: '已达到封顶价' };
    }
  }

  return null; // Valid bid
}

/**
 * Calculate the next bid amount based on current price and increment.
 */
export function calculateNextBid(
  currentPrice: number,
  bidIncrement: number,
): number {
  return currentPrice + bidIncrement;
}
