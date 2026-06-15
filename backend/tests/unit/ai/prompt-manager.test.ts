import { describe, it, expect, beforeEach } from 'vitest'
import { PromptManager } from '@/ai/prompt-manager.js'

describe('PromptManager', () => {
  let pm: PromptManager

  beforeEach(() => {
    pm = new PromptManager()
  })

  it('registers and retrieves templates', () => {
    pm.register({
      id: 'test',
      name: '测试模板',
      systemPrompt: '你好 {{name}}',
      variables: ['name'],
    })

    const template = pm.get('test')
    expect(template).toBeDefined()
    expect(template!.id).toBe('test')
  })

  it('returns undefined for unknown template', () => {
    expect(pm.get('nonexistent')).toBeUndefined()
  })

  it('renders template with variable substitution', () => {
    pm.register({
      id: 'greeting',
      name: '问候',
      systemPrompt: '你好 {{name}}，欢迎来到 {{place}}',
      variables: ['name', 'place'],
    })

    const result = pm.render('greeting', { name: '小明', place: '直播间' })
    expect(result).toBe('你好 小明，欢迎来到 直播间')
  })

  it('render throws for missing template', () => {
    expect(() => pm.render('missing', {})).toThrow('Prompt 模板不存在: missing')
  })

  it('render leaves unreplaced variables intact', () => {
    pm.register({
      id: 'partial',
      name: '部分替换',
      systemPrompt: 'Hello {{name}}, age is {{age}}',
      variables: ['name', 'age'],
    })

    const result = pm.render('partial', { name: 'Test' })
    expect(result).toBe('Hello Test, age is {{age}}')
  })

  it('buildMessages returns system + user messages', () => {
    pm.register({
      id: 'chat',
      name: '聊天',
      systemPrompt: '你是助手 {{role}}',
      variables: ['role', 'userMessage'],
    })

    const messages = pm.buildMessages('chat', {
      role: '客服',
      userMessage: '你好',
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('你是助手 客服')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toBe('你好')
  })
})
