// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AIChatPanel from '../AIChatPanel'

vi.mock('@/lib/ai-client', () => ({
  streamAIResponse: vi.fn(),
}))

vi.mock('@/design-system/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

afterEach(() => cleanup())

describe('AIChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders input and send button', () => {
    render(<AIChatPanel roomId="1" />)
    expect(screen.getByPlaceholderText('问我任何竞拍问题...')).toBeDefined()
  })

  it('renders quick action buttons', () => {
    render(<AIChatPanel roomId="1" />)
    expect(screen.getByText('值不值？')).toBeDefined()
    expect(screen.getByText('出多少合适？')).toBeDefined()
    expect(screen.getByText('还有多久？')).toBeDefined()
  })

  it('shows empty state message', () => {
    render(<AIChatPanel roomId="1" />)
    expect(screen.getByText(/有什么想问的/)).toBeDefined()
  })

  it('disables input when streaming', () => {
    render(<AIChatPanel roomId="1" />)
    const input = screen.getByPlaceholderText('问我任何竞拍问题...')
    expect((input as HTMLInputElement).disabled).toBe(false)
  })
})
