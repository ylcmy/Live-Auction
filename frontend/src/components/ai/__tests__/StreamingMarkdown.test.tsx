// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import StreamingMarkdown from '../StreamingMarkdown'

afterEach(() => cleanup())

describe('StreamingMarkdown', () => {
  it('renders markdown content', () => {
    render(
      <StreamingMarkdown content={`# 标题

正文内容`} isStreaming={false} />
    )
    expect(screen.getByText('标题')).toBeDefined()
    expect(screen.getByText('正文内容')).toBeDefined()
  })

  it('shows cursor when streaming', () => {
    const { container } = render(
      <StreamingMarkdown content="正在输入" isStreaming={true} />
    )
    const cursor = container.querySelector('.animate-pulse')
    expect(cursor).toBeDefined()
  })

  it('hides cursor when not streaming', () => {
    const { container } = render(
      <StreamingMarkdown content="输入完成" isStreaming={false} />
    )
    const cursor = container.querySelector('.animate-pulse')
    expect(cursor).toBeNull()
  })

  it('renders empty state gracefully', () => {
    const { container } = render(
      <StreamingMarkdown content="" isStreaming={true} />
    )
    expect(container.textContent).toBe('')
  })

  it('renders list items', () => {
    render(
      <StreamingMarkdown content={`- 第一点
- 第二点`} isStreaming={false} />
    )
    expect(screen.getByText('第一点')).toBeDefined()
    expect(screen.getByText('第二点')).toBeDefined()
  })
})
