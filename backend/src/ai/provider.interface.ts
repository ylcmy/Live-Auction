import type { AIChatRequest, AIChatResponse, AIStreamChunk } from './types.js'

export interface AIProvider {
  name: string
  chat(request: AIChatRequest): Promise<AIChatResponse>
  chatStream(request: AIChatRequest): AsyncGenerator<AIStreamChunk>
}
