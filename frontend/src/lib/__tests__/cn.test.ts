import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('merges multiple class names into a single string', () => {
    const result = cn('foo', 'bar', 'baz');
    expect(result).toBe('foo bar baz');
  });

  it('handles conditional classes with truthy values', () => {
    const result = cn('base', true && 'active');
    expect(result).toContain('base');
    expect(result).toContain('active');
  });

  it('filters out falsy conditional classes', () => {
    const result = cn('base', false && 'hidden', null, undefined, 0, '');
    expect(result).toBe('base');
  });

  it('resolves tailwind-merge conflicts: later padding wins', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });

  it('resolves tailwind-merge conflicts: later background wins', () => {
    const result = cn('bg-red-500', 'bg-blue-500');
    expect(result).toBe('bg-blue-500');
  });

  it('does not merge non-conflicting tailwind classes', () => {
    const result = cn('p-2', 'm-4', 'text-sm');
    expect(result).toBe('p-2 m-4 text-sm');
  });

  it('returns empty string for empty input', () => {
    expect(cn()).toBe('');
  });

  it('returns empty string when all inputs are falsy', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });

  it('handles array inputs', () => {
    const result = cn(['foo', 'bar'], 'baz');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
    expect(result).toContain('baz');
  });

  it('handles object syntax for conditional classes', () => {
    const result = cn({ foo: true, bar: false, baz: true });
    expect(result).toContain('foo');
    expect(result).not.toContain('bar');
    expect(result).toContain('baz');
  });
});
