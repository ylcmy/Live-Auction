import { describe, it, expect } from 'vitest';
import { formatMsCompact } from '@/lib/format';

describe('formatMsCompact', () => {
  it('formats 0ms as 00:00', () => {
    expect(formatMsCompact(0)).toBe('00:00');
  });

  it('formats milliseconds under 1 minute', () => {
    expect(formatMsCompact(65000)).toBe('01:05');
  });

  it('formats over 10 minutes', () => {
    expect(formatMsCompact(630000)).toBe('10:30');
  });

  it('floors partial seconds', () => {
    expect(formatMsCompact(90500)).toBe('01:30');
  });

  it('handles negative values as 00:00', () => {
    expect(formatMsCompact(-1000)).toBe('00:00');
  });
});
