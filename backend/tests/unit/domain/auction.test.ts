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
