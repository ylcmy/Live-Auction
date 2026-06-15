import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsightRepo = {
  getProductOverview: vi.fn(),
  getProductStatusDistribution: vi.fn(),
  getAuctionPerformance: vi.fn(),
  getBiddingHeat: vi.fn(),
  getDailyRevenue: vi.fn(),
  getRevenueOverview: vi.fn(),
  getTopProducts: vi.fn(),
  getConversionRate: vi.fn(),
}

const mockPromptManager = {
  register: vi.fn(),
  render: vi.fn(),
}

const mockAiService = {
  chatStream: vi.fn(),
}

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
}

const mockIsRedisAvailable = vi.fn()

vi.mock('@/repositories/insight.repo.js', () => ({
  insightRepo: mockInsightRepo,
}))

vi.mock('@/ai/prompt-manager.js', () => ({
  promptManager: mockPromptManager,
}))

vi.mock('@/ai/ai.service.js', () => ({
  aiService: mockAiService,
}))

vi.mock('@/infrastructure/cache/redis.js', () => ({
  cache: mockCache,
  isRedisAvailable: mockIsRedisAvailable,
}))

vi.mock('@/middleware/logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

describe('InsightService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Restore default mock behaviors
    mockInsightRepo.getProductOverview.mockResolvedValue({ total: 10 })
    mockInsightRepo.getProductStatusDistribution.mockResolvedValue([
      { status: 'listed', count: 5 },
      { status: 'active', count: 3 },
    ])
    mockInsightRepo.getAuctionPerformance.mockResolvedValue({
      completed_count: 8,
      sold_count: 6,
      unsold_count: 2,
      avg_premium_rate: 1.5,
      avg_bid_count: 10,
    })
    mockInsightRepo.getBiddingHeat.mockResolvedValue({
      hourly_distribution: [{ hour: 10, bid_count: 20 }, { hour: 14, bid_count: 35 }],
      top_3_hours: [{ hour: 14, bid_count: 35 }, { hour: 10, bid_count: 20 }],
      unique_bidders: 50,
      repeat_bidders: 15,
    })
    mockInsightRepo.getDailyRevenue.mockResolvedValue([
      { date: '2026-06-01', amount: 500 },
    ])
    mockInsightRepo.getRevenueOverview.mockResolvedValue({
      total_orders: 20,
      total_revenue: 5000,
      paid_orders: 15,
    })
    mockInsightRepo.getTopProducts.mockResolvedValue([
      { name: '翡翠手镯', revenue: 2000 },
    ])
    mockInsightRepo.getConversionRate.mockResolvedValue({
      total_ended: 8,
      with_order: 6,
    })

    mockPromptManager.render.mockReturnValue('分析报告 system prompt')

    mockAiService.chatStream.mockReturnValue((async function* () {
      yield { content: '# 分析报告', done: false }
      yield { content: '详细内容', done: true }
    })())

    mockCache.get.mockResolvedValue(null)
    mockCache.set.mockResolvedValue('OK')
    mockIsRedisAvailable.mockReturnValue(true)
  })

  it('collectMerchantData returns complete insight data', async () => {
    const { insightService } = await import('@/ai/insight.service.js')
    const data = await insightService.collectMerchantData(1)

    expect(data.overview.totalProducts).toBe(10)
    expect(data.overview.activeAuctions).toBe(8) // listed(5) + active(3)
    expect(data.overview.totalOrders).toBe(20)
    expect(data.overview.totalRevenue).toBe(5000)
    expect(data.auctionPerformance.completedCount).toBe(8)
    expect(data.auctionPerformance.soldCount).toBe(6)
    expect(data.auctionPerformance.unsoldCount).toBe(2)
    expect(data.auctionPerformance.avgPremiumRate).toBe(1.5)
    expect(data.auctionPerformance.avgBidCount).toBe(10)
    expect(data.biddingHeat.uniqueBidders).toBe(50)
    expect(data.biddingHeat.repeatBidders).toBe(15)
    expect(data.biddingHeat.hourlyDistribution).toEqual({ '10': 20, '14': 35 })
    expect(data.biddingHeat.peakHours).toEqual([14, 10])
    expect(data.revenueAnalysis.dailyRevenue).toHaveLength(1)
    expect(data.revenueAnalysis.topProducts).toHaveLength(1)
    expect(data.revenueAnalysis.conversionRate).toBe(0.75)
  })

  it('generateInsightStream yields chunks from AI', async () => {
    const { insightService } = await import('@/ai/insight.service.js')
    const chunks: string[] = []
    for await (const chunk of insightService.generateInsightStream(1)) {
      chunks.push(chunk.content)
    }

    expect(chunks).toEqual(['# 分析报告', '详细内容'])
  })

  it('generateInsightStream uses cache when available', async () => {
    mockCache.get.mockResolvedValueOnce('cached insight content')

    const { insightService } = await import('@/ai/insight.service.js')
    const chunks: string[] = []
    for await (const chunk of insightService.generateInsightStream(1)) {
      chunks.push(chunk.content)
    }

    expect(chunks).toEqual(['cached insight content'])
  })

  it('generateInsightStream writes result to cache after generation', async () => {
    const { insightService } = await import('@/ai/insight.service.js')

    // Exhaust the generator
    const chunks: string[] = []
    for await (const chunk of insightService.generateInsightStream(1)) {
      chunks.push(chunk.content)
    }

    expect(mockCache.set).toHaveBeenCalledWith('ai:insight:1', '# 分析报告详细内容', 1800)
  })
})
