import { aiService } from './ai.service.js'
import { promptManager } from './prompt-manager.js'
import { db } from '@/infrastructure/db/knex.js'
import { isRedisAvailable, redis } from '@/infrastructure/cache/redis.js'
import { createRateLimiter } from '@/infrastructure/rate-limiter.factory.js'
import { AppError } from '@/lib/app-error.js'
import { logger } from '@/middleware/logger.js'
import type { AuctionContext, AIStreamChunk } from './types.js'

// 加载 prompt 模板（side-effect import）
import './prompts/bidding-assistant.js'

export interface ChatRequest {
  roomId: string
  message: string
  userId: number
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

const userRateLimiter = createRateLimiter({
  keyPrefix: 'ai_chat_user',
  points: 10,
  duration: 60,
})

export const chatService = {
  async buildAuctionContext(roomId: string): Promise<AuctionContext | null> {
    // 查询直播间
    const room = await db('live_rooms')
      .where({ id: roomId })
      .first()

    if (!room) {
      return null
    }

    // 查询当前进行中的拍卖
    const activeSession = await db('auction_sessions')
      .join('products', 'auction_sessions.product_id', 'products.id')
      .join('auction_rules', 'auction_sessions.rule_id', 'auction_rules.id')
      .where('auction_sessions.room_id', roomId)
      .where('auction_sessions.status', 'active')
      .select(
        'auction_sessions.id as session_id',
        'auction_sessions.current_price',
        'auction_sessions.winner_id',
        'auction_sessions.started_at',
        'auction_sessions.extension_count',
        'products.name as product_name',
        'products.description as product_description',
        'products.category',
        'auction_rules.start_price',
        'auction_rules.ceiling_price',
        'auction_rules.bid_increment',
        'auction_rules.duration_seconds',
        'auction_rules.extend_seconds',
      )
      .first()

    // 在线观众数（从 Redis 读取）
    let viewerCount = 0
    if (isRedisAvailable()) {
      try {
        const count = await redis.scard(`room:${roomId}:participants`)
        viewerCount = count ?? 0
      } catch (err) {
        logger.warn({ err, roomId }, 'chat_service_viewer_count_error')
      }
    }

    if (!activeSession) {
      return {
        room: { title: room.title, viewerCount },
        currentAuction: null,
      }
    }

    // 查询出价记录
    const bidResult = await db('bid_records')
      .where({ session_id: activeSession.session_id })
      .count('* as count')
      .first()

    const totalBids = Number(bidResult?.count ?? 0)

    // 查询当前最高出价者
    const topBid = await db('bid_records')
      .where({ session_id: activeSession.session_id })
      .orderBy('bid_amount', 'desc')
      .first()

    const leadingBidder = topBid ? String(topBid.user_id) : ''

    // 计算剩余时间
    const durationTotal =
      activeSession.duration_seconds +
      activeSession.extension_count * activeSession.extend_seconds
    const startedAt = new Date(activeSession.started_at).getTime()
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
    const remainingSeconds = Math.max(0, durationTotal - elapsedSeconds)

    return {
      room: { title: room.title, viewerCount },
      currentAuction: {
        productName: activeSession.product_name,
        productDescription: activeSession.product_description,
        category: activeSession.category,
        startPrice: activeSession.start_price,
        currentPrice: activeSession.current_price,
        ceilingPrice: activeSession.ceiling_price,
        bidIncrement: activeSession.bid_increment,
        remainingSeconds,
        extensionCount: activeSession.extension_count,
        totalBids,
        leadingBidder,
        isUserLeading: false,
      },
    }
  },

  async *generateChatStream(request: ChatRequest): AsyncGenerator<AIStreamChunk> {
    const rateLimitKey = `${request.userId}:${request.roomId}`

    try {
      await userRateLimiter.consume(rateLimitKey)
    } catch {
      throw new AppError('聊天请求过于频繁，请稍后再试', 429)
    }

    const context = await this.buildAuctionContext(request.roomId)
    if (!context) {
      throw new AppError('直播间不存在', 404)
    }

    const contextJson = JSON.stringify(context, null, 2)
    const systemPrompt = promptManager.render('bidding-assistant', {
      auctionContext: contextJson,
    })

    // 构建消息：system + 最近历史（最多 12 条）+ 当前用户消息
    const recentHistory = (request.history ?? []).slice(-12)
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: request.message },
    ]

    yield* aiService.chatStream({ messages })
  },
}
