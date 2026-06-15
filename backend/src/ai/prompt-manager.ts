import type { AIMessage } from './types.js'

export interface PromptTemplate {
  id: string
  name: string
  systemPrompt: string
  variables: string[]
}

export class PromptManager {
  private templates = new Map<string, PromptTemplate>()

  register(template: PromptTemplate): void {
    this.templates.set(template.id, template)
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id)
  }

  render(templateId: string, vars: Record<string, string>): string {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Prompt 模板不存在: ${templateId}`)
    }

    let result = template.systemPrompt
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{${key}}}`, value)
    }
    return result
  }

  buildMessages(
    templateId: string,
    vars: Record<string, string>,
  ): AIMessage[] {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Prompt 模板不存在: ${templateId}`)
    }

    const systemContent = this.render(templateId, vars)
    const userMessage = vars['userMessage'] || ''

    const messages: AIMessage[] = [
      { role: 'system', content: systemContent },
    ]

    if (userMessage) {
      messages.push({ role: 'user', content: userMessage })
    }

    return messages
  }
}

export const promptManager = new PromptManager()
