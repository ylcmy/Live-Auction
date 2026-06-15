import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  }
})

vi.mock('@/config/env.js', () => ({
  env: {
    AI_API_KEY: 'test-key',
    AI_BASE_URL: 'https://api.deepseek.com',
    AI_MODEL: 'deepseek-chat',
    AI_MAX_TOKENS: 2048,
  },
}))

vi.mock('@/middleware/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('DeepSeekProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chat returns complete response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '你好' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })

    const { createDeepSeekProvider } = await import('@/ai/providers/deepseek.provider.js')
    const provider = createDeepSeekProvider()

    const result = await provider.chat({
      messages: [{ role: 'user', content: '你好' }],
    })

    expect(result.content).toBe('你好')
    expect(result.usage?.totalTokens).toBe(15)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 2048,
      })
    )
  })

  it('chatStream yields chunks', async () => {
    async function* mockStream() {
      yield { choices: [{ delta: { content: '你' } }] }
      yield { choices: [{ delta: { content: '好' } }] }
      yield { choices: [{ delta: {} }] }
    }

    mockCreate.mockResolvedValueOnce(mockStream())

    const { createDeepSeekProvider } = await import('@/ai/providers/deepseek.provider.js')
    const provider = createDeepSeekProvider()

    const chunks: string[] = []
    for await (const chunk of provider.chatStream({
      messages: [{ role: 'user', content: '你好' }],
    })) {
      chunks.push(chunk.content)
    }

    expect(chunks).toEqual(['你', '好', ''])
  })

  it('chat throws on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API Error'))

    const { createDeepSeekProvider } = await import('@/ai/providers/deepseek.provider.js')
    const provider = createDeepSeekProvider()

    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('AI Provider 请求失败')
  })
})
