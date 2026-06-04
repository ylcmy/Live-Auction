export interface BidValidationContext {
  auctionStatus: string;
  sellerId: number;
  currentPrice: number;
  bidIncrement: number;
  ceilingPrice: number | null;
  idempotencyKeyExists: boolean;
  rateLimitExceeded: boolean;
}

export interface BidValidationError {
  code: number;
  message: string;
}

export function validateBid(
  userId: number,
  context: BidValidationContext,
): BidValidationError | null {
  if (context.auctionStatus !== 'active') {
    return { code: 40900, message: '竞拍已结束或未开始' };
  }

  if (userId === context.sellerId) {
    return { code: 40300, message: '不能竞拍自己的商品' };
  }

  if (context.idempotencyKeyExists) {
    return { code: 40901, message: '重复的出价请求' };
  }

  if (context.rateLimitExceeded) {
    return { code: 42900, message: '出价过于频繁，请稍后再试' };
  }

  if (context.ceilingPrice !== null && context.ceilingPrice !== undefined) {
    const nextBid = context.currentPrice + context.bidIncrement;
    if (nextBid > context.ceilingPrice) {
      return { code: 40901, message: '已达到封顶价' };
    }
  }

  return null;
}
