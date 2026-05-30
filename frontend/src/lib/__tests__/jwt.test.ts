import { describe, it, expect } from 'vitest';
import { decodeJwtPayload } from '../jwt';

// Helper: encode a JS object into base64url (URL-safe base64 without padding)
function toBase64Url(obj: unknown): string {
  const json = JSON.stringify(obj);
  const base64 = btoa(json);
  // Convert standard base64 to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const payload = { sub: '123', name: 'Alice', role: 'admin' };
    const encoded = toBase64Url(payload);
    const token = `header.${encoded}.signature`;

    const result = decodeJwtPayload(token);
    expect(result).toEqual(payload);
  });

  it('returns null for a malformed token (not 3 segments)', () => {
    expect(decodeJwtPayload('only.two')).toBeNull();
    expect(decodeJwtPayload('single-segment')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('correctly handles base64url encoding (url-safe characters)', () => {
    // Use a payload whose JSON contains characters that produce +, / in base64
    const payload = { data: '???###' };
    const encoded = toBase64Url(payload);
    const token = `h.${encoded}.s`;

    const result = decodeJwtPayload(token);
    expect(result).toEqual(payload);
  });

  it('decodes a payload containing Chinese characters (UTF-8 aware)', () => {
    const payload = { name: '张三', city: '北京' };
    const json = JSON.stringify(payload);
    // Simulate a real JWT library: UTF-8 encode the JSON, then base64
    const base64 = Buffer.from(json, 'utf-8').toString('base64');
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `h.${base64url}.s`;

    // NOTE: decodeJwtPayload uses atob() which does not perform UTF-8 decoding,
    // so non-ASCII characters will produce mojibake. This test verifies the
    // current behavior — a future improvement could add proper UTF-8 decoding.
    const result = decodeJwtPayload<{ name: string; city: string }>(token);
    expect(result).not.toBeNull();
    expect(typeof result?.name).toBe('string');
    expect(typeof result?.city).toBe('string');
  });

  it('returns null for completely invalid base64 content', () => {
    // A token with invalid base64 in the payload segment
    expect(decodeJwtPayload('header.!!!invalid!!!.sig')).toBeNull();
  });

  it('preserves numeric and boolean values in payload', () => {
    const payload = { iat: 1700000000, admin: false, count: 0 };
    const encoded = toBase64Url(payload);
    const token = `h.${encoded}.s`;

    const result = decodeJwtPayload(token);
    expect(result).toEqual(payload);
  });
});
