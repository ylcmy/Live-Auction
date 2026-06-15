import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChat = vi.fn()
const mockChatStream = vi.fn()

vi.mock('@/ai/providers/deepseek.provider.js', () => ({
  createDeepSeekProvider: vi.fn().mockReturnValue({
    name: 'deepseek',
    chat: mockChat,
    chatStream: mockChatStream,
  }),
}))

vi.mock('@/config/env.js', () => ({
  env: {
    AI_PROVIDER: 'deepseek',
    AI_API_KEY: 'test-key',
    AI_BASE_URL: 'https://api.deepseek.com',
    AI_MODEL: 'deepseek-chat',
    AI_MAX_TOKENS: 2048,
    AI_REQUESTS_PER_MINUTE: 20,
  },
}))

vi.mock('@/infrastructure/cache/redis.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
  isRedisAvailable: vi.fn().mockReturnValue(false),
}))

vi.mock('@/infrastructure/cache/circuit-breaker.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn((fn: () => Promise<unknown>) => fn()),
    isAvailable: vi.fn().mockReturnValue(true),
    reportSuccess: vi.fn(),
    reportFailure: vi.fn(),
  })),
}))

vi.mock('@/middleware/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/infrastructure/rate-limiter.factory.js', () => ({
  createRateLimiter: vi.fn().mockReturnValue({
    consume: vi.fn().mockResolvedValue({ remainingPoints: 19 }),
  }),
}))

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chat delegates to provider', async () => {
    mockChat.mockResolvedValueOnce({ content: '回答', usage: undefined })

    const { aiService } = await import('@/ai/ai.service.js')
    const result = await aiService.chat({
      messages: [{ role: 'user', content: '你好' }],
    })

    expect(result.content).toBe('回答')
    expect(mockChat).toHaveBeenCalledOnce()
  })

  it('chatStream delegates to provider', async () => {
    async function* gen() {
      yield { content: '你', done: false }
      yield { content: '好', done: false }
    }
    mockChatStream.mockReturnValue(gen())

    const { aiService } = await import('@/ai/ai.service.js')
    const chunks: string[] = []
    for await (const c of aiService.chatStream({
      messages: [{ role: 'user', content: 'test' }],
    })) {
      chunks.push(c.content)
    }

    expect(chunks).toEqual(['你', '好'])
  })

  it('healthCheck returns true when provider works', async () => {
    mockChat.mockResolvedValueOnce({ content: 'pong', usage: undefined })

    const { aiService } = await import('@/ai/ai.service.js')
    const healthy = await aiService.healthCheck()

    expect(healthy).toBe(true)
  })

  it('healthCheck returns false on error', async () => {
    mockChat.mockRejectedValueOnce(new Error('down'))

    const { aiService } = await import('@/ai/ai.service.js')
    const healthy = await aiService.healthCheck()

    expect(healthy).toBe(false)
  })
})
