import OpenAI from 'openai'
import { env } from '@/config/env.js'
import { AppError } from '@/lib/app-error.js'
import { logger } from '@/middleware/logger.js'
import type { AIProvider } from '../provider.interface.js'
import type { AIChatRequest, AIChatResponse, AIStreamChunk } from '../types.js'

export function createDeepSeekProvider(): AIProvider {
  if (!env.AI_API_KEY) {
    logger.warn('AI_API_KEY is not configured — AI features will fail')
  }

  const client = new OpenAI({
    apiKey: env.AI_API_KEY || 'missing-key',
    baseURL: env.AI_BASE_URL,
  })

  return {
    name: 'deepseek',

    async chat(request: AIChatRequest): Promise<AIChatResponse> {
      try {
        const response = await client.chat.completions.create({
          model: request.model || env.AI_MODEL,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens || env.AI_MAX_TOKENS,
        })

        const choice = response.choices[0]
        return {
          content: choice?.message?.content || '',
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : undefined,
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        logger.error({ err }, 'ai_provider_chat_error')
        throw new AppError(`AI Provider 请求失败: ${detail}`, 502)
      }
    },

    async *chatStream(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
      try {
        const stream = await client.chat.completions.create({
          model: request.model || env.AI_MODEL,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens || env.AI_MAX_TOKENS,
          stream: true,
        })

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          yield { content, done: false }
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        logger.error({ err }, 'ai_provider_stream_error')
        throw new AppError(`AI Provider 流式请求失败: ${detail}`, 502)
      }
    },
  }
}
