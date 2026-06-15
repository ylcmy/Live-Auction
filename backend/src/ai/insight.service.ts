import { insightRepo } from '@/repositories/insight.repo.js'
import { promptManager } from './prompt-manager.js'
import { aiService } from './ai.service.js'
import { cache, isRedisAvailable } from '@/infrastructure/cache/redis.js'
import { logger } from '@/middleware/logger.js'
import type { MerchantInsightData, AIStreamChunk } from './types.js'

// 加载 prompt 模板（side-effect import）
import './prompts/insight.js'

const CACHE_PREFIX = 'ai:insight:'
const CACHE_TTL = 1800 // 30 分钟

export const insightService = {
  async collectMerchantData(merchantId: number): Promise<MerchantInsightData> {
    const [
      productOverview,
      productStatus,
      auctionPerf,
      biddingHeat,
      dailyRevenue,
      revenueOverview,
      topProducts,
      conversionData,
    ] = await Promise.all([
      insightRepo.getProductOverview(merchantId),
      insightRepo.getProductStatusDistribution(merchantId),
      insightRepo.getAuctionPerformance(merchantId),
      insightRepo.getBiddingHeat(merchantId),
      insightRepo.getDailyRevenue(merchantId, 30),
      insightRepo.getRevenueOverview(merchantId),
      insightRepo.getTopProducts(merchantId, 5),
      insightRepo.getConversionRate(merchantId),
    ])

    // activeAuctions = listed + active product count
    const activeCount = productStatus
      .filter((r: { status: string; count: number }) =>
        ['listed', 'active'].includes(r.status),
      )
      .reduce((sum: number, r: { status: string; count: number }) => sum + r.count, 0)

    // 将 hourly_distribution 数组转为 Record<hour, bid_count>
    const hourlyDistribution: Record<string, number> = {}
    for (const row of biddingHeat.hourly_distribution) {
      hourlyDistribution[String(row.hour)] = row.bid_count
    }

    // peakHours = top_3_hours 的 hour 列表
    const peakHours = biddingHeat.top_3_hours.map((r) => r.hour)

    // conversionRate = with_order / total_ended (避免除零)
    const conversionRate =
      conversionData.total_ended > 0
        ? conversionData.with_order / conversionData.total_ended
        : 0

    return {
      overview: {
        totalProducts: productOverview.total,
        activeAuctions: activeCount,
        totalOrders: revenueOverview.total_orders,
        totalRevenue: revenueOverview.total_revenue,
      },
      auctionPerformance: {
        completedCount: auctionPerf.completed_count,
        soldCount: auctionPerf.sold_count,
        unsoldCount: auctionPerf.unsold_count,
        avgPremiumRate: auctionPerf.avg_premium_rate ?? 0,
        avgBidCount: auctionPerf.avg_bid_count ?? 0,
      },
      biddingHeat: {
        hourlyDistribution,
        peakHours,
        uniqueBidders: biddingHeat.unique_bidders,
        repeatBidders: biddingHeat.repeat_bidders,
      },
      revenueAnalysis: {
        dailyRevenue: dailyRevenue.map((r) => ({
          date: r.date,
          amount: r.amount,
        })),
        conversionRate,
        topProducts: topProducts.map((r) => ({
          name: r.name,
          revenue: r.revenue,
        })),
      },
    }
  },

  async *generateInsightStream(merchantId: number): AsyncGenerator<AIStreamChunk> {
    // 尝试从缓存读取
    const cacheKey = `${CACHE_PREFIX}${merchantId}`
    if (isRedisAvailable()) {
      try {
        const cached = await cache.get(cacheKey)
        if (cached) {
          const text = cached as string
          yield { content: text, done: false }
          return
        }
      } catch (err) {
        logger.warn({ err }, 'insight_cache_read_error')
      }
    }

    // 采集数据
    const data = await this.collectMerchantData(merchantId)
    const dataJson = JSON.stringify(data, null, 2)

    // 构建 prompt
    const systemPrompt = promptManager.render('merchant-insight', {
      merchantData: dataJson,
    })

    // 流式生成
    let fullContent = ''
    const stream = aiService.chatStream({
      messages: [{ role: 'system', content: systemPrompt }],
    })

    for await (const chunk of stream) {
      fullContent += chunk.content
      yield chunk
    }

    // 写入缓存
    if (isRedisAvailable() && fullContent) {
      try {
        await cache.set(cacheKey, fullContent, CACHE_TTL)
      } catch (err) {
        logger.warn({ err }, 'insight_cache_write_error')
      }
    }
  },
}
