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
