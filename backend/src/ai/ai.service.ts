import { createDeepSeekProvider } from './providers/deepseek.provider.js'
import type { AIProvider } from './provider.interface.js'
import type { AIChatRequest, AIChatResponse, AIStreamChunk } from './types.js'
import { AppError } from '@/lib/app-error.js'
import { createRateLimiter } from '@/infrastructure/rate-limiter.factory.js'
import { CircuitBreaker } from '@/infrastructure/cache/circuit-breaker.js'
import logger from '@/middleware/logger.js'

function createProvider(): AIProvider {
  return createDeepSeekProvider()
}

const provider = createProvider()

const rateLimiter = createRateLimiter({
  keyPrefix: 'ai_global',
  points: 20,
  duration: 60,
})

// AI Provider 专用熔断器：3 次失败后熔断 30 秒
const aiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  openDurationMs: 30_000,
})

export const aiService = {
  getProvider(): AIProvider {
    return provider
  },

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    try {
      await rateLimiter.consume('global')
    } catch {
      throw new AppError('AI 请求过于频繁，请稍后再试', 429)
    }

    return aiCircuitBreaker.execute(
      () => provider.chat(request),
      () => {
        throw new AppError('AI 服务暂时不可用（熔断中）', 503)
      },
    )
  },

  async *chatStream(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    try {
      await rateLimiter.consume('global')
    } catch {
      throw new AppError('AI 请求过于频繁，请稍后再试', 429)
    }

    // CircuitBreaker 不支持 AsyncGenerator，使用 isAvailable 检查
    if (!aiCircuitBreaker.isAvailable()) {
      throw new AppError('AI 服务暂时不可用（熔断中）', 503)
    }

    try {
      yield* provider.chatStream(request)
      aiCircuitBreaker.reportSuccess()
    } catch (err) {
      aiCircuitBreaker.reportFailure()
      throw err
    }
  },

  async healthCheck(): Promise<boolean> {
    try {
      await provider.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
      })
      return true
    } catch (err) {
      logger.warn({ err }, 'ai_health_check_failed')
      return false
    }
  },
}
