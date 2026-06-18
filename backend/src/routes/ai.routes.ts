import type { FastifyInstance } from 'fastify'
import { authMiddleware, requireRole } from '@/middleware/auth.js'
import { ipRateLimiter } from '@/middleware/rateLimiter.js'
import { insightService } from '@/ai/insight.service.js'
import { aiService } from '@/ai/ai.service.js'
import { chatService } from '@/ai/chat.service.js'
import {
  setupSSEHeaders,
  sendSSEData,
  sendSSEError,
  closeSSE,
} from '@/lib/sse-helper.js'
import { AppError } from '@/lib/app-error.js'

// 洞察限流: 5次/小时/商家
const insightLimiter = ipRateLimiter(5, 3600)

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware)

  // AI 健康检查
  app.get('/api/ai/health', async (_req, reply) => {
    const healthy = await aiService.healthCheck()
    return reply.send({
      code: 0,
      message: healthy ? 'ok' : 'ai_unavailable',
      data: { healthy },
      timestamp: Date.now(),
    })
  })

  // 结构化数据接口：返回商家运营原始数据供前端绘制图表
  app.get('/api/ai/insight/data', {
    preHandler: [requireRole('merchant'), insightLimiter],
  }, async (req, reply) => {
    const merchantId = req.auth!.userId
    const days = Math.min(Math.max(Number((req.query as { days?: string }).days) || 30, 1), 365)

    try {
      const data = await insightService.collectMerchantData(merchantId, days)
      return reply.send({
        code: 0,
        message: 'ok',
        data,
        timestamp: Date.now(),
      })
    } catch (err) {
      if (err instanceof AppError) {
        return reply.code(err.statusCode).send({
          code: err.statusCode,
          message: err.message,
          timestamp: Date.now(),
        })
      }
      return reply.code(500).send({
        code: 500,
        message: '数据采集失败',
        timestamp: Date.now(),
      })
    }
  })

  // SSE: 商家数据洞察
  app.get('/api/ai/insight', {
    preHandler: [requireRole('merchant'), insightLimiter],
  }, async (req, reply) => {
    const merchantId = req.auth!.userId
    const days = Math.min(Math.max(Number((req.query as { days?: string }).days) || 30, 1), 365)

    req.raw.on('close', () => {
      // SSE 连接断开，流式生成器会被 GC 回收
    })

    setupSSEHeaders(reply)

    try {
      for await (const chunk of insightService.generateInsightStream(merchantId, days)) {
        if (chunk.content) {
          sendSSEData(reply, JSON.stringify({ content: chunk.content }))
        }
        if (chunk.done) {
          sendSSEData(reply, JSON.stringify({ done: true }))
          break
        }
      }
    } catch (err) {
      if (err instanceof AppError) {
        sendSSEError(reply, err.message)
      } else {
        sendSSEError(reply, 'AI 服务暂时不可用')
      }
    } finally {
      closeSSE(reply)
    }
  })

  // SSE: AI 竞拍助手对话（Phase 2 实现，此处预留桩）
  app.post('/api/ai/chat', {
    preHandler: [requireRole('user', 'merchant', 'admin')],
    schema: {
      body: {
        type: 'object',
        required: ['roomId', 'message'],
        properties: {
          roomId: { type: 'string' },
          message: { type: 'string', minLength: 1, maxLength: 500 },
          history: {
            type: 'array',
            maxItems: 12,
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { roomId, message, history } = req.body as {
      roomId: string
      message: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    setupSSEHeaders(reply)

    try {
      const userId = req.auth!.userId

      for await (const chunk of chatService.generateChatStream({
        roomId,
        message,
        userId,
        history,
      })) {
        if (chunk.content) {
          sendSSEData(reply, JSON.stringify({ content: chunk.content }))
        }
        if (chunk.done) {
          sendSSEData(reply, JSON.stringify({ done: true }))
          break
        }
      }
    } catch (err) {
      if (err instanceof AppError) {
        sendSSEError(reply, err.message)
      } else {
        sendSSEError(reply, 'AI 助手暂时不可用')
      }
    } finally {
      closeSSE(reply)
    }
  })
}
