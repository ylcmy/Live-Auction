/**
 * T063: Auction state machine (PURE functions, NO I/O)
 *
 * Domain-level state machine for auction lifecycle transitions.
 * These functions are side-effect-free and can be tested in isolation.
 */

export type AuctionStatus =
  | 'pending'
  | 'active'
  | 'ended'
  | 'cancelled'
  | 'unsold';

const VALID_TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  pending: ['active', 'cancelled'],
  active: ['ended', 'cancelled', 'unsold'],
  ended: [], // terminal state
  cancelled: [], // terminal state
  unsold: [], // terminal state
};

/**
 * Check whether a transition from one auction status to another is valid.
 */
export function canTransition(
  from: AuctionStatus,
  to: AuctionStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check whether the next bid would hit or exceed the ceiling price.
 * Returns true if the ceiling would be met, false otherwise
 * (including when no ceiling is set).
 */
export function checkCeilingPrice(
  currentPrice: number,
  bidIncrement: number,
  ceilingPrice: number | null,
): boolean {
  if (ceilingPrice === null || ceilingPrice === undefined) return false;
  return currentPrice + bidIncrement >= ceilingPrice;
}
