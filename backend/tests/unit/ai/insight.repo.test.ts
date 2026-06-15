import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a chainable mock that returns itself for all Knex methods
function createChainMock() {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'where', 'whereIn', 'leftJoin', 'join',
    'groupBy', 'orderBy', 'limit', 'count', 'avg', 'sum',
    'first', 'raw',
  ]
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  // Terminal methods
  chain.then = (resolve: (v: unknown) => void) => resolve([])
  return chain
}

const mockChain = createChainMock()
const mockDb = vi.fn().mockReturnValue(mockChain)

vi.mock('@/infrastructure/db/knex.js', () => ({
  db: Object.assign(mockDb, { raw: vi.fn((sql: string, ...args: unknown[]) => sql), fn: { now: vi.fn() } }),
}))

describe('InsightRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chain to return itself
    for (const key of Object.keys(mockChain)) {
      if (key !== 'then') {
        (mockChain[key] as ReturnType<typeof vi.fn>).mockReturnValue(mockChain)
      }
    }
  })

  it('getProductOverview queries products table', async () => {
    mockChain.first = vi.fn().mockResolvedValueOnce({ total: 10 })

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getProductOverview(1)

    expect(mockDb).toHaveBeenCalledWith('products')
    expect(result).toEqual({ total: 10 })
  })

  it('getProductStatusDistribution queries products grouped by status', async () => {
    mockChain.then = (resolve: (v: unknown) => void) =>
      resolve([
        { status: 'listed', count: 5 },
        { status: 'ended', count: 3 },
      ])

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getProductStatusDistribution(1)

    expect(mockDb).toHaveBeenCalledWith('products')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ status: 'listed', count: 5 })
  })

  it('getAuctionPerformance queries auction_sessions joined with products', async () => {
    mockChain.first = vi.fn().mockResolvedValueOnce({
      completed_count: 5,
      sold_count: 3,
      unsold_count: 2,
      avg_premium_rate: 1.5,
      avg_bid_count: 8,
    })

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getAuctionPerformance(1)

    expect(result.completed_count).toBe(5)
    expect(result.sold_count).toBe(3)
    expect(result.unsold_count).toBe(2)
  })

  it('getBiddingHeat returns hourly distribution, peak hours, and bidder stats', async () => {
    mockChain.then = (resolve: (v: unknown) => void) =>
      resolve([
        { hour: 10, bid_count: 20 },
        { hour: 14, bid_count: 15 },
        { hour: 20, bid_count: 30 },
      ])
    mockChain.first = vi.fn().mockResolvedValueOnce({ unique_bidders: 50, repeat_bidders: 12 })

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getBiddingHeat(1)

    expect(result.hourly_distribution).toBeDefined()
    expect(result.unique_bidders).toBe(50)
    expect(result.repeat_bidders).toBe(12)
  })

  it('getDailyRevenue returns revenue array', async () => {
    mockChain.then = (resolve: (v: unknown) => void) =>
      resolve([{ date: '2026-06-01', amount: 100 }])

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getDailyRevenue(1, 30)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: '2026-06-01', amount: 100 })
  })

  it('getRevenueOverview returns totals from orders', async () => {
    mockChain.first = vi.fn().mockResolvedValueOnce({
      total_orders: 20,
      total_revenue: 5000,
      paid_orders: 15,
    })

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getRevenueOverview(1)

    expect(result.total_orders).toBe(20)
    expect(result.total_revenue).toBe(5000)
    expect(result.paid_orders).toBe(15)
  })

  it('getTopProducts returns top products by revenue', async () => {
    mockChain.then = (resolve: (v: unknown) => void) =>
      resolve([
        { name: 'Product A', revenue: 300 },
        { name: 'Product B', revenue: 200 },
      ])

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getTopProducts(1, 5)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'Product A', revenue: 300 })
  })

  it('getConversionRate returns conversion ratio', async () => {
    mockChain.first = vi.fn().mockResolvedValueOnce({
      total_ended: 10,
      with_order: 7,
    })

    const { insightRepo } = await import('@/repositories/insight.repo.js')
    const result = await insightRepo.getConversionRate(1)

    expect(result.total_ended).toBe(10)
    expect(result.with_order).toBe(7)
  })
})
