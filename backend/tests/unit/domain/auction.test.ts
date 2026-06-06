import { describe, it, expect } from 'vitest';
import {
  canTransition,
  checkCeilingPrice,
} from '../../../src/domain/auction.js';

describe('canTransition', () => {
  it('should allow pending→active', () =>
    expect(canTransition('pending', 'active')).toBe(true));
  it('should allow pending→cancelled', () =>
    expect(canTransition('pending', 'cancelled')).toBe(true));
  it('should allow active→ended', () =>
    expect(canTransition('active', 'ended')).toBe(true));
  it('should allow active→cancelled', () =>
    expect(canTransition('active', 'cancelled')).toBe(true));
  it('should allow active→unsold', () =>
    expect(canTransition('active', 'unsold')).toBe(true));
  it('should not allow ended→active (terminal)', () =>
    expect(canTransition('ended', 'active')).toBe(false));
  it('should not allow cancelled→active (terminal)', () =>
    expect(canTransition('cancelled', 'active')).toBe(false));
  it('should not allow pending→ended (invalid jump)', () =>
    expect(canTransition('pending', 'ended')).toBe(false));
});

describe('canTransition - exhaustive illegal transitions (FR-004/FR-005)', () => {
  // ─── pending → invalid targets ─────────────────────────────────────────────
  it('should not allow pending→unsold', () =>
    expect(canTransition('pending', 'unsold')).toBe(false));
  it('should not allow pending→pending (self-loop)', () =>
    expect(canTransition('pending', 'pending')).toBe(false));

  // ─── active → invalid targets ──────────────────────────────────────────────
  it('should not allow active→pending (backward)', () =>
    expect(canTransition('active', 'pending')).toBe(false));
  it('should not allow active→active (self-loop)', () =>
    expect(canTransition('active', 'active')).toBe(false));

  // ─── ended (terminal) → any target ─────────────────────────────────────────
  it('should not allow ended→cancelled (terminal)', () =>
    expect(canTransition('ended', 'cancelled')).toBe(false));
  it('should not allow ended→unsold (terminal)', () =>
    expect(canTransition('ended', 'unsold')).toBe(false));
  it('should not allow ended→pending (terminal)', () =>
    expect(canTransition('ended', 'pending')).toBe(false));
  it('should not allow ended→ended (terminal self-loop)', () =>
    expect(canTransition('ended', 'ended')).toBe(false));

  // ─── cancelled (terminal) → any target ─────────────────────────────────────
  it('should not allow cancelled→ended (terminal)', () =>
    expect(canTransition('cancelled', 'ended')).toBe(false));
  it('should not allow cancelled→pending (terminal)', () =>
    expect(canTransition('cancelled', 'pending')).toBe(false));
  it('should not allow cancelled→unsold (terminal)', () =>
    expect(canTransition('cancelled', 'unsold')).toBe(false));
  it('should not allow cancelled→cancelled (terminal self-loop)', () =>
    expect(canTransition('cancelled', 'cancelled')).toBe(false));

  // ─── unsold (terminal) → any target ────────────────────────────────────────
  it('should not allow unsold→active (terminal)', () =>
    expect(canTransition('unsold', 'active')).toBe(false));
  it('should not allow unsold→ended (terminal)', () =>
    expect(canTransition('unsold', 'ended')).toBe(false));
  it('should not allow unsold→pending (terminal)', () =>
    expect(canTransition('unsold', 'pending')).toBe(false));
  it('should not allow unsold→cancelled (terminal)', () =>
    expect(canTransition('unsold', 'cancelled')).toBe(false));
  it('should not allow unsold→unsold (terminal self-loop)', () =>
    expect(canTransition('unsold', 'unsold')).toBe(false));
});

describe('checkCeilingPrice', () => {
  it('should return false when no ceiling', () =>
    expect(checkCeilingPrice(400, 10, null)).toBe(false));
  it('should return false when next bid below ceiling', () =>
    expect(checkCeilingPrice(480, 10, 500)).toBe(false));
  it('should return true when next bid reaches ceiling', () =>
    expect(checkCeilingPrice(490, 10, 500)).toBe(true));
  it('should return true when next bid exceeds ceiling', () =>
    expect(checkCeilingPrice(495, 10, 500)).toBe(true));
});

describe('checkCeilingPrice - additional boundary tests', () => {
  it('should return false when ceilingPrice is undefined (null-like)', () => {
    // @ts-expect-error -- testing undefined as null-like
    expect(checkCeilingPrice(400, 10, undefined)).toBe(false);
  });

  it('should return false for null ceilingPrice (no ceiling restriction)', () => {
    expect(checkCeilingPrice(10000, 1000, null)).toBe(false);
  });

  it('should return true when currentPrice + bidIncrement equals ceilingPrice exactly', () => {
    // nextBid = 490 + 10 = 500 >= 500 → true
    expect(checkCeilingPrice(490, 10, 500)).toBe(true);
  });

  it('should return true when nextBid exceeds ceilingPrice by 1', () => {
    // nextBid = 491 + 10 = 501 >= 500 → true
    expect(checkCeilingPrice(491, 10, 500)).toBe(true);
  });

  it('should return false when nextBid is 1 below ceilingPrice', () => {
    // nextBid = 489 + 10 = 499 >= 500 → false
    expect(checkCeilingPrice(489, 10, 500)).toBe(false);
  });

  it('should handle ceilingPrice of 0', () => {
    // nextBid = 0 + 10 = 10 >= 0 → true
    expect(checkCeilingPrice(0, 10, 0)).toBe(true);
  });

  it('should handle ceilingPrice of 0 with zero bidIncrement', () => {
    // nextBid = 0 + 0 = 0 >= 0 → true
    expect(checkCeilingPrice(0, 0, 0)).toBe(true);
  });

  it('should handle very large bidIncrement', () => {
    // nextBid = 100 + 999999 = 1000099 >= 500 → true
    expect(checkCeilingPrice(100, 999999, 500)).toBe(true);
  });

  it('should handle bidIncrement of 0 (never reaches ceiling from below)', () => {
    // nextBid = 400 + 0 = 400 >= 500 → false
    expect(checkCeilingPrice(400, 0, 500)).toBe(false);
  });

  it('should handle negative currentPrice', () => {
    // nextBid = -100 + 10 = -90 >= 500 → false
    expect(checkCeilingPrice(-100, 10, 500)).toBe(false);
  });

  it('should handle both currentPrice and ceilingPrice as 0', () => {
    // nextBid = 0 + 1 = 1 >= 0 → true
    expect(checkCeilingPrice(0, 1, 0)).toBe(true);
  });

  it('should return true when currentPrice already exceeds ceiling', () => {
    // nextBid = 600 + 10 = 610 >= 500 → true
    expect(checkCeilingPrice(600, 10, 500)).toBe(true);
  });
});
