const API_BASE = '/api';
const TIMEOUT_MS = 10000;

let refreshPromise: Promise<string | null> | null = null;

interface RequestConfig extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  timeout?: number;
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}

async function getNewToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        clearTokens();
        return null;
      }

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return null;
      }

      const json = await response.json();
      const newToken = json.data?.accessToken;
      if (newToken) {
        localStorage.setItem('accessToken', newToken);
        return newToken;
      }

      clearTokens();
      return null;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { body, params, timeout = TIMEOUT_MS, ...rest } = config;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (query) url += `?${query}`;
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('accessToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      const newToken = await getNewToken();
      if (newToken) {
        return request<T>(endpoint, {
          ...config,
          headers: {
            ...(config.headers as Record<string, string>),
            Authorization: `Bearer ${newToken}`,
          },
        });
      }
      throw new Error('登录已过期，请重新登录');
    }

    const json = await response.json();

    if (!response.ok) {
      const error = new Error(json.message || `Request failed with status ${response.status}`);
      (error as any).code = json.code || response.status;
      (error as any).data = json;
      throw error;
    }

    return json;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | undefined>) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};

export default api;
