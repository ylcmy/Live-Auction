import { createDeepSeekProvider } from './providers/deepseek.provider.js'
import type { AIProvider } from './provider.interface.js'
import type { AIChatRequest, AIChatResponse, AIStreamChunk } from './types.js'
import { AppError } from '@/lib/app-error.js'
import { createRateLimiter } from '@/infrastructure/rate-limiter.factory.js'
import { CircuitBreaker } from '@/infrastructure/cache/circuit-breaker.js'
import { logger } from '@/middleware/logger.js'

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
    const meta = {
      messages: request.messages.length,
      model: request.model,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
    }
    logger.info(meta, 'ai_chat_request_received')

    try {
      await rateLimiter.consume('global')
      logger.info(meta, 'ai_chat_rate_limit_passed')
    } catch {
      logger.warn(meta, 'ai_chat_rate_limited')
      throw new AppError('AI 请求过于频繁，请稍后再试', 429)
    }

    if (!aiCircuitBreaker.isAvailable()) {
      logger.warn(meta, 'ai_chat_circuit_open')
    }

    try {
      const response = await aiCircuitBreaker.execute(
        () => provider.chat(request),
        () => {
          throw new AppError('AI 服务暂时不可用（熔断中）', 503)
        },
      )
      logger.info(
        { ...meta, usage: response.usage },
        'ai_chat_response_success',
      )
      return response
    } catch (err) {
      logger.error(
        { ...meta, err: (err as Error).message, stack: (err as Error).stack },
        'ai_chat_response_failed',
      )
      throw err
    }
  },

  async *chatStream(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    const meta = {
      messages: request.messages.length,
      model: request.model,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
    }
    logger.info(meta, 'ai_chat_stream_request_received')

    try {
      await rateLimiter.consume('global')
      logger.info(meta, 'ai_chat_stream_rate_limit_passed')
    } catch {
      logger.warn(meta, 'ai_chat_stream_rate_limited')
      throw new AppError('AI 请求过于频繁，请稍后再试', 429)
    }

    // CircuitBreaker 不支持 AsyncGenerator，使用 isAvailable 检查
    if (!aiCircuitBreaker.isAvailable()) {
      logger.warn(meta, 'ai_chat_stream_circuit_open')
      throw new AppError('AI 服务暂时不可用（熔断中）', 503)
    }

    let chunkCount = 0
    let totalContentLength = 0
    try {
      for await (const chunk of provider.chatStream(request)) {
        if (chunk.content) {
          chunkCount += 1
          totalContentLength += chunk.content.length
        }
        yield chunk
        if (chunk.done) break
      }
      aiCircuitBreaker.reportSuccess()
      logger.info(
        { ...meta, chunkCount, totalContentLength },
        'ai_chat_stream_success',
      )
    } catch (err) {
      aiCircuitBreaker.reportFailure()
      logger.error(
        {
          ...meta,
          chunkCount,
          totalContentLength,
          err: (err as Error).message,
          stack: (err as Error).stack,
        },
        'ai_chat_stream_failed',
      )
      throw err
    }
  },

  async healthCheck(): Promise<boolean> {
    logger.info({}, 'ai_health_check_start')
    const start = Date.now()
    try {
      await provider.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
      })
      logger.info(
        { durationMs: Date.now() - start },
        'ai_health_check_success',
      )
      return true
    } catch (err) {
      logger.warn(
        {
          durationMs: Date.now() - start,
          err: (err as Error).message,
        },
        'ai_health_check_failed',
      )
      return false
    }
  },
}
