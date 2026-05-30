import { vi } from 'vitest';

export function createMockApiResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue({ code: 0, message: 'success', data }),
    text: vi.fn().mockResolvedValue(JSON.stringify({ code: 0, message: 'success', data })),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

export function createMockApiError(status: number, message: string) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ code: status, message, data: null }),
    text: vi.fn().mockResolvedValue(JSON.stringify({ code: status, message, data: null })),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

export function setupFetchMock() {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
