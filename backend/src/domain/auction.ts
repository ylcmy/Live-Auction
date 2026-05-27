export type AuctionStatus =
  | 'pending'
  | 'active'
  | 'ended'
  | 'cancelled'
  | 'unsold';

const VALID_TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  pending: ['active', 'cancelled'],
  active: ['ended', 'cancelled', 'unsold'],
  ended: [],
  cancelled: [],
  unsold: [],
};
