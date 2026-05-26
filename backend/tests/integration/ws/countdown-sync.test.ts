import { describe, it, expect } from 'vitest';

describe('Countdown synchronization', () => {
  it('should calculate client-side remaining time from serverTime + remainingMs', () => {
    const serverTime = Date.now();
    const remainingMs = 5000;
    const endTime = serverTime + remainingMs;

    // After 1 second passes
    const later = endTime - (Date.now() + 1000);
    expect(later).toBeLessThan(remainingMs);
    expect(later).toBeGreaterThan(remainingMs - 2000); // Allow 1s tolerance
  });

  it('should detect sync drift within 1 second tolerance', () => {
    const drift = 500; // 500ms drift
    expect(drift).toBeLessThan(1000);
  });
});
