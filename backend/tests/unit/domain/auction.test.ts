import { describe, it, expect } from 'vitest';
import { canTransition } from '../../../src/domain/auction.js';

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
