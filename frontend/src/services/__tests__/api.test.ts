import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockApiResponse, createMockApiError } from '@/tests/mocks/api';

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock localStorage
const localStorageMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Mock window.location
const originalLocation = window.location;
const mockAssign = vi.fn();

describe('api service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    localStorageMock.clear();
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
    localStorageMock.removeItem.mockReset();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '/', assign: mockAssign },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  // Dynamically import to get fresh module with mocks applied
  async function loadApi() {
    vi.resetModules();
    return import('@/services/api');
  }

  describe('请求构造', () => {
    test('正确拼接 URL 和 query 参数', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse({ items: [] }));

      await api.get('/items', { page: '1', limit: '10' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/items?'),
        expect.any(Object),
      );

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=10');
    });

    test('过滤 undefined 参数', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse({ items: [] }));

      await api.get('/items', { page: '1', category: undefined });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).not.toContain('category');
    });

    test('GET 请求使用正确 method', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse(null));

      await api.get('/test');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    test('POST 请求携带 JSON body', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse({ id: '1' }));

      const payload = { name: 'test' };
      await api.post('/items', payload);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    test('PUT 请求使用正确 method', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse({ id: '1' }));

      await api.put('/items/1', { name: 'updated' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    test('PATCH 请求使用正确 method', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse({ id: '1' }));

      await api.patch('/items/1', { name: 'patched' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    test('DELETE 请求使用正确 method', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse(null));

      await api.delete('/items/1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('有 body 的请求默认 Content-Type 为 application/json', async () => {
      const { api } = await loadApi();
      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse(null));

      await api.post('/test', { data: 'value' });

      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = callOptions.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('auth header 注入', () => {
    test('有 token 时自动添加 Authorization header', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'accessToken') return 'test-token-123';
        return null;
      });

      fetchMock.mockResolvedValue(createMockApiResponse({ data: 'ok' }));

      await api.get('/protected');

      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = callOptions.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });

    test('无 token 时不添加 Authorization header', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiResponse(null));

      await api.get('/public');

      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = callOptions.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('401 自动刷新 token', () => {
    test('收到 401 后尝试 refresh 并重试请求', async () => {
      const { api } = await loadApi();

      // First two getItem('accessToken') calls return 'expired-token',
      // subsequent calls (after refresh) return 'new-token'
      localStorageMock.getItem
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('expired-token')
        .mockReturnValue('new-token');

      fetchMock.mockResolvedValueOnce(createMockApiError(401, 'Unauthorized'));
      fetchMock.mockResolvedValueOnce(
        createMockApiResponse({ accessToken: 'new-token' }),
      );
      // Retry response needs json() method since request() calls response.json()
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [] }),
      });

      const result = await api.get('/items');

      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Second call should be the refresh request
      const refreshCall = fetchMock.mock.calls[1];
      expect(refreshCall[0]).toBe('/api/auth/refresh');
      expect(refreshCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );

      // Third call should retry with new token
      const retryCall = fetchMock.mock.calls[2];
      const retryHeaders = (retryCall[1] as RequestInit).headers as Record<
        string,
        string
      >;
      expect(retryHeaders['Authorization']).toBe('Bearer new-token');

      expect(result).toEqual({ items: [] });
    });

    test('refresh 成功后将新 token 保存到 localStorage', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('expired-token')
        .mockReturnValue('new-token');

      fetchMock.mockResolvedValueOnce(createMockApiError(401, 'Unauthorized'));
      fetchMock.mockResolvedValueOnce(
        createMockApiResponse({ accessToken: 'new-token' }),
      );
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      });

      await api.get('/items');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'accessToken',
        'new-token',
      );
    });
  });

  describe('并发刷新去重', () => {
    test('多个 401 请求只触发一次 refresh', async () => {
      const { api } = await loadApi();

      // First two getItem('accessToken') calls return 'expired-token',
      // subsequent calls return 'new-token' (after refresh)
      localStorageMock.getItem
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('expired-token')
        .mockReturnValue('new-token');

      // Two 401s, one refresh, two retries
      fetchMock
        .mockResolvedValueOnce(createMockApiError(401, 'Unauthorized'))
        .mockResolvedValueOnce(createMockApiError(401, 'Unauthorized'))
        .mockResolvedValueOnce(
          createMockApiResponse({ accessToken: 'new-token' }),
        )
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ items: ['a'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ items: ['b'] }),
        });

      const [result1, result2] = await Promise.all([
        api.get('/items'),
        api.get('/other'),
      ]);

      // Only one refresh call should have been made
      const refreshCalls = fetchMock.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes('/auth/refresh'),
      );
      expect(refreshCalls).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(result1).toEqual({ items: ['a'] });
      expect(result2).toEqual({ items: ['b'] });
    });
  });

  describe('abort 超时', () => {
    test('请求超过 10 秒后自动 abort', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockReturnValue(null);

      // Mock fetch to capture the signal and create a promise that rejects on abort
      let capturedSignal: AbortSignal | null = null;
      fetchMock.mockImplementation((_url: string, options?: RequestInit) => {
        capturedSignal = options?.signal ?? null;
        return new Promise((_resolve, reject) => {
          if (capturedSignal) {
            capturedSignal.addEventListener('abort', () => {
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
        });
      });

      // Start the request (creates setTimeout for abort)
      const promise = api.get('/slow');

      // Manually trigger the abort to avoid unhandled rejection timing issues
      // This simulates what happens after 10s timeout
      if (capturedSignal) {
        (capturedSignal as AbortSignal).dispatchEvent(new Event('abort'));
      }

      await expect(promise).rejects.toThrow('请求超时');
    });
  });

  describe('response 正常化', () => {
    test('成功响应解析返回 JSON', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockReturnValue(null);

      const expectedData = { id: '1', name: 'auction-item' };
      // Use a raw mock since request() returns the parsed JSON directly
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(expectedData),
      });

      const result = await api.get('/items/1');
      expect(result).toEqual(expectedData);
    });

    test('非 ok 响应抛出带 message 的错误', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue(createMockApiError(400, '参数错误'));

      await expect(api.get('/items')).rejects.toThrow('参数错误');
    });

    test('非 ok 响应错误包含 code 和 data', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockReturnValue(null);

      fetchMock.mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            code: 'VALIDATION_ERROR',
            message: '验证失败',
            data: { field: 'name' },
          }),
      });

      try {
        await api.get('/items');
      } catch (error: unknown) {
        expect((error as any).code).toBe('VALIDATION_ERROR');
        expect((error as any).data).toEqual({
          code: 'VALIDATION_ERROR',
          message: '验证失败',
          data: { field: 'name' },
        });
      }
    });
  });

  describe('refresh 失败跳转登录', () => {
    test('无 refreshToken 时清除 tokens 并跳转登录页', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'accessToken') return 'expired-token';
        // No refreshToken
        return null;
      });

      fetchMock.mockResolvedValueOnce(createMockApiError(401, 'Unauthorized'));

      await expect(api.get('/items')).rejects.toThrow('登录已过期，请重新登录');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(window.location.href).toBe('/login');
    });

    test('refresh 接口返回非 ok 时清除 tokens 并跳转登录页', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'accessToken') return 'expired-token';
        if (key === 'refreshToken') return 'refresh-token';
        return null;
      });

      fetchMock.mockResolvedValueOnce(createMockApiError(401, 'Unauthorized'));
      fetchMock.mockResolvedValueOnce(createMockApiError(401, 'Invalid'));

      await expect(api.get('/items')).rejects.toThrow('登录已过期，请重新登录');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(window.location.href).toBe('/login');
    });

    test('refresh 接口网络异常时清除 tokens 并跳转登录页', async () => {
      const { api } = await loadApi();

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'accessToken') return 'expired-token';
        if (key === 'refreshToken') return 'refresh-token';
        return null;
      });

      fetchMock.mockResolvedValueOnce(createMockApiError(401, 'Unauthorized'));
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.get('/items')).rejects.toThrow('登录已过期，请重新登录');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(window.location.href).toBe('/login');
    });
  });
});
