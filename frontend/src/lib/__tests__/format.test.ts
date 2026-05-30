import { describe, it, expect } from 'vitest';
import { formatPrice, formatMs, formatTime, getPriceLabel } from '../format';

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------
describe('formatPrice', () => {
  it('formats a normal number with 2 decimal places', () => {
    expect(formatPrice(100)).toBe('¥100.00');
    expect(formatPrice(9.9)).toBe('¥9.90');
  });

  it('returns ¥-- for NaN', () => {
    expect(formatPrice(NaN)).toBe('¥--');
  });

  it('returns ¥-- for null', () => {
    expect(formatPrice(null)).toBe('¥--');
  });

  it('returns ¥-- for undefined', () => {
    expect(formatPrice(undefined)).toBe('¥--');
  });

  it('formats 0 correctly', () => {
    expect(formatPrice(0)).toBe('¥0.00');
  });

  it('formats negative numbers', () => {
    expect(formatPrice(-5)).toBe('¥-5.00');
  });

  it('formats very large numbers', () => {
    expect(formatPrice(9999999.99)).toBe('¥9999999.99');
  });

  it('handles numeric string input', () => {
    expect(formatPrice('123.45')).toBe('¥123.45');
  });

  it('returns ¥-- for non-numeric string', () => {
    expect(formatPrice('abc')).toBe('¥--');
  });
});

// ---------------------------------------------------------------------------
// formatMs
// ---------------------------------------------------------------------------
describe('formatMs', () => {
  it('formats 0 ms', () => {
    expect(formatMs(0)).toBe('00:00.000');
  });

  it('formats milliseconds under 1 second', () => {
    expect(formatMs(500)).toBe('00:00.500');
  });

  it('formats exactly 1 minute', () => {
    expect(formatMs(60_000)).toBe('01:00.000');
  });

  it('formats over 1 hour', () => {
    // 3661000ms = 1h 1min 1s
    expect(formatMs(3_661_000)).toBe('61:01.000');
  });

  it('formats a typical value with minutes, seconds and ms', () => {
    // 125430ms = 2min 5sec 430ms
    expect(formatMs(125_430)).toBe('02:05.430');
  });

  it('pads single-digit minutes and seconds', () => {
    // 5000ms = 0min 5sec 0ms
    expect(formatMs(5000)).toBe('00:05.000');
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
describe('formatTime', () => {
  it('formats a valid ISO date string', () => {
    const iso = '2024-01-15T10:30:00.000Z';
    const result = formatTime(iso);
    // toLocaleString output varies by locale, just verify it returns a non-empty string
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('does not throw for a valid ISO string', () => {
    expect(() => formatTime('2023-12-25T00:00:00Z')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getPriceLabel
// ---------------------------------------------------------------------------
describe('getPriceLabel', () => {
  const makeItem = (
    status: string,
    currentPrice: number,
    startPrice: number,
  ) => ({
    status,
    currentPrice,
    rule: { startPrice },
  });

  it('returns startPrice label for listed status', () => {
    const result = getPriceLabel(makeItem('listed', 0, 100));
    expect(result).toEqual({ label: '起拍价', price: 100 });
  });

  it('returns currentPrice when active and currentPrice > startPrice', () => {
    const result = getPriceLabel(makeItem('active', 200, 100));
    expect(result).toEqual({ label: '当前最高价', price: 200 });
  });

  it('returns startPrice when active and currentPrice <= startPrice', () => {
    const result = getPriceLabel(makeItem('active', 100, 100));
    expect(result).toEqual({ label: '起拍价', price: 100 });
  });

  it('returns currentPrice label for ended status', () => {
    const result = getPriceLabel(makeItem('ended', 500, 100));
    expect(result).toEqual({ label: '落槌价', price: 500 });
  });

  it('returns startPrice label for unsold status', () => {
    const result = getPriceLabel(makeItem('unsold', 0, 100));
    expect(result).toEqual({ label: '起拍价', price: 100 });
  });

  it('returns startPrice label for cancelled status', () => {
    const result = getPriceLabel(makeItem('cancelled', 0, 100));
    expect(result).toEqual({ label: '起拍价', price: 100 });
  });

  it('returns startPrice label for unknown status (default)', () => {
    const result = getPriceLabel(makeItem('unknown_status', 50, 100));
    expect(result).toEqual({ label: '起拍价', price: 100 });
  });
});
