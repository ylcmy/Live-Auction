import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey } from '../idempotency';

// UUID v4 regex: 8-4-4-4-12 hex characters
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateIdempotencyKey', () => {
  it('returns a string', () => {
    const key = generateIdempotencyKey();
    expect(typeof key).toBe('string');
  });

  it('returns a valid UUID v4 format', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(UUID_REGEX);
  });

  it('returns a 36-character string (with hyphens)', () => {
    const key = generateIdempotencyKey();
    expect(key).toHaveLength(36);
  });

  it('generates unique values on successive calls', () => {
    const keys = new Set(
      Array.from({ length: 100 }, () => generateIdempotencyKey()),
    );
    expect(keys.size).toBe(100);
  });

  it('contains exactly 4 hyphens at correct positions', () => {
    const key = generateIdempotencyKey();
    const parts = key.split('-');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toHaveLength(8);
    expect(parts[1]).toHaveLength(4);
    expect(parts[2]).toHaveLength(4);
    expect(parts[3]).toHaveLength(4);
    expect(parts[4]).toHaveLength(12);
  });
});
