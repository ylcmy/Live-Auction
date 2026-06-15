import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/ai/ai.service.js', () => ({
  aiService: {
    chatStream: vi.fn().mockReturnValue((async function* () {
      yield { content: '当前价格' }
      yield { content: '很划算' }
    })()),
  },
}))

vi.mock('@/ai/prompt-manager.js', () => ({
  promptManager: {
    register: vi.fn(),
    render: vi.fn().mockReturnValue('竞拍助手 system prompt'),
  },
}))

vi.mock('@/infrastructure/db/knex.js', () => {
  const mockRoom = { id: '1', title: '测试直播间', status: 'live' }
  function createChain(resolvedValue: unknown = null) {
    const chain: Record<string, unknown> = {}
    const methods = ['where', 'join', 'select', 'orderBy', 'count', 'first', 'raw']
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    chain.then = (resolve: (v: unknown) => void) => resolve(resolvedValue)
    return chain
  }
  const mockDb = vi.fn().mockImplementation((table: string) => {
    if (table === 'live_rooms') return createChain(mockRoom)
    return createChain(null)
  })
  return { db: mockDb }
})

vi.mock('@/infrastructure/cache/redis.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null) },
  isRedisAvailable: vi.fn().mockReturnValue(false),
}))

vi.mock('@/infrastructure/rate-limiter.factory.js', () => ({
  createRateLimiter: vi.fn().mockReturnValue({
    consume: vi.fn().mockResolvedValue({ remainingPoints: 9 }),
  }),
}))

describe('ChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generateChatStream yields response chunks', async () => {
    const { chatService } = await import('@/ai/chat.service.js')
    const chunks: string[] = []
    for await (const chunk of chatService.generateChatStream({
      roomId: '1',
      message: '值不值？',
      userId: 1,
    })) {
      if (chunk.content) chunks.push(chunk.content)
    }

    expect(chunks).toEqual(['当前价格', '很划算'])
  })

  it('generateChatStream renders prompt with auction context', async () => {
    const { chatService } = await import('@/ai/chat.service.js')
    const { promptManager } = await import('@/ai/prompt-manager.js')

    // Collect all chunks
    const chunks: string[] = []
    for await (const chunk of chatService.generateChatStream({
      roomId: '1',
      message: 'test',
      userId: 1,
    })) {
      if (chunk.content) chunks.push(chunk.content)
    }

    expect(promptManager.render).toHaveBeenCalledWith(
      'bidding-assistant',
      expect.objectContaining({ auctionContext: expect.any(String) })
    )
  })
})
