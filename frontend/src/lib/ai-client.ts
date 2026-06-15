export interface SSEChunk {
  content?: string
  done?: boolean
}

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

export async function* streamAIResponse(
  url: string,
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<SSEChunk> {
  const token = localStorage.getItem('accessToken')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

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

export async function* streamAIGetResponse(
  url: string,
  signal?: AbortSignal
): AsyncGenerator<SSEChunk> {
  const token = localStorage.getItem('accessToken')

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal,
  })

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
