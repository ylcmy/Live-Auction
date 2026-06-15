// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamAIResponse, streamAIGetResponse } from '../ai-client'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock localStorage
const mockGetItem = vi.fn().mockReturnValue('test-token')
vi.stubGlobal('localStorage', { getItem: mockGetItem })

function createMockSSEStream(chunks: string[]) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe('streamAIResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('yields content from SSE data lines', async () => {
    const sseData = [
      'data: {"content":"你好"}\n\n',
      'data: {"content":"世界"}\n\n',
      'data: {"done":true}\n\n',
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: createMockSSEStream(sseData),
    })

    const chunks: string[] = []
    for await (const chunk of streamAIResponse('/api/ai/insight', {})) {
      if (chunk.content) chunks.push(chunk.content)
    }

    expect(chunks).toEqual(['你好', '世界'])
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/insight',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const iter = streamAIResponse('/api/ai/insight', {})

    await expect(iter.next()).rejects.toThrow('AI 请求失败: 500')
  })

  it('handles empty body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: null,
    })

    const iter = streamAIResponse('/api/ai/insight', {})

    await expect(iter.next()).rejects.toThrow('响应体为空')
  })

  it('sends POST request with JSON body', async () => {
    const sseData = ['data: {"content":"test"}\n\n']

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: createMockSSEStream(sseData),
    })

    const body = { roomId: '123' }
    for await (const _ of streamAIResponse('/api/ai/insight', body)) {
      // consume
    }

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/insight',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(body),
      })
    )
  })

  it('handles split chunks (incomplete lines carried over)', async () => {
    // Simulate a chunk that splits a line in the middle
    const sseData = [
      'data: {"content":"你',
      '好"}\n\ndata: {"done":true}\n\n',
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: createMockSSEStream(sseData),
    })

    const chunks: string[] = []
    for await (const chunk of streamAIResponse('/api/ai/insight', {})) {
      if (chunk.content) chunks.push(chunk.content)
    }

    expect(chunks).toEqual(['你好'])
  })

  it('uses AbortSignal when provided', async () => {
    const controller = new AbortController()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: createMockSSEStream([]),
    })

    for await (const _ of streamAIResponse('/api/ai/insight', {}, controller.signal)) {
      // consume
    }

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/insight',
      expect.objectContaining({
        signal: controller.signal,
      })
    )
  })

  it('does not send Authorization header when no token', async () => {
    mockGetItem.mockReturnValueOnce(null)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: createMockSSEStream([]),
    })

    for await (const _ of streamAIResponse('/api/ai/insight', {})) {
      // consume
    }

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers).not.toHaveProperty('Authorization')
  })
})

describe('streamAIGetResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends GET request and yields content', async () => {
    const sseData = [
      'data: {"content":"结果"}\n\n',
      'data: {"done":true}\n\n',
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: createMockSSEStream(sseData),
    })

    const chunks: string[] = []
    for await (const chunk of streamAIGetResponse('/api/ai/summary')) {
      if (chunk.content) chunks.push(chunk.content)
    }

    expect(chunks).toEqual(['结果'])
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/summary',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })

    const iter = streamAIGetResponse('/api/ai/summary')

    await expect(iter.next()).rejects.toThrow('AI 请求失败: 403')
  })
})
