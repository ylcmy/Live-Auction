export interface SSEChunk {
  content?: string
  done?: boolean
  error?: boolean
}

// --- Token refresh (mirrors api.ts logic) ---

let refreshPromise: Promise<string | null> | null = null

async function getNewToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) return null

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) return null

      const json = await response.json()
      const newToken = json.data?.accessToken
      if (newToken) {
        localStorage.setItem('accessToken', newToken)
        return newToken
      }
      return null
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// --- SSE stream parser ---

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEChunk> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    // Keep the last potentially incomplete line in buffer
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue

      const jsonStr = trimmed.slice(6)
      if (!jsonStr) continue

      try {
        yield JSON.parse(jsonStr) as SSEChunk
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process any remaining buffered data
  if (buffer.trim()) {
    const trimmed = buffer.trim()
    if (trimmed.startsWith('data: ')) {
      const jsonStr = trimmed.slice(6)
      if (jsonStr) {
        try {
          yield JSON.parse(jsonStr) as SSEChunk
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

// --- Internal: fetch + parse SSE with a given token ---

async function* doStream(
  url: string,
  init: RequestInit,
  token: string | null
): AsyncGenerator<SSEChunk> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, { ...init, headers })

  if (!response.ok) {
    throw new Error(`AI 请求失败: ${response.status}`)
  }

  if (!response.body) {
    throw new Error('响应体为空')
  }

  const reader = response.body.getReader()
  try {
    yield* parseSSEStream(reader)
  } finally {
    reader.releaseLock()
  }
}

// --- Public API ---

/**
 * POST SSE request with automatic 401 → token refresh → retry.
 */
export async function* streamAIResponse(
  url: string,
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<SSEChunk> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }

  const token = localStorage.getItem('accessToken')

  try {
    yield* doStream(url, init, token)
  } catch (err) {
    if (err instanceof Error && err.message.includes('401')) {
      const newToken = await getNewToken()
      if (newToken) {
        yield* doStream(url, init, newToken)
        return
      }
    }
    throw err
  }
}

/**
 * GET SSE request with automatic 401 → token refresh → retry.
 */
export async function* streamAIGetResponse(
  url: string,
  signal?: AbortSignal
): AsyncGenerator<SSEChunk> {
  const init: RequestInit = {
    method: 'GET',
    headers: {},
    signal,
  }

  const token = localStorage.getItem('accessToken')

  try {
    yield* doStream(url, init, token)
  } catch (err) {
    if (err instanceof Error && err.message.includes('401')) {
      const newToken = await getNewToken()
      if (newToken) {
        yield* doStream(url, init, newToken)
        return
      }
    }
    throw err
  }
}
