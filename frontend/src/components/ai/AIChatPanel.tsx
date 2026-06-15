import { useState, useRef, useCallback } from 'react'
import { Button } from '@/design-system/components/ui/button'
import { Input } from '@/design-system/components/ui/input'
import { useToast } from '@/design-system/hooks/use-toast'
import { streamAIResponse } from '@/lib/ai-client'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AIChatPanelProps {
  roomId: string
}

const QUICK_ACTIONS = [
  { label: '值不值？', prompt: '这个商品值不值这个价？' },
  { label: '出多少合适？', prompt: '我应该出多少钱比较合适？' },
  { label: '还有多久？', prompt: '这个拍卖还有多久结束？' },
]

export default function AIChatPanel({ roomId }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMessage: ChatMessage = { role: 'user', content: text.trim() }
      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setIsStreaming(true)

      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      const recentHistory = [...messages, userMessage].slice(-12)

      let assistantContent = ''
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      try {
        for await (const chunk of streamAIResponse(
          '/api/ai/chat',
          {
            roomId,
            message: text.trim(),
            history: recentHistory,
          },
          controller.signal
        )) {
          if (chunk.content) {
            assistantContent += chunk.content
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                role: 'assistant',
                content: assistantContent,
              }
              return updated
            })
          }
          if (chunk.done) break
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        toast({
          title: 'AI 助手提示',
          description: '暂时无法回答，请稍后再试',
          variant: 'destructive',
        })
        setMessages((prev) => prev.filter((m) => m.content !== ''))
      } finally {
        setIsStreaming(false)
        abortRef.current = null
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
          })
        }, 100)
      }
    },
    [isStreaming, messages, roomId, toast]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">有什么想问的？我可以帮你分析当前竞拍情况 🎯</p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <Bot className="h-6 w-6 mt-1 shrink-0 text-primary" />
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {msg.content || (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
            {msg.role === 'user' && (
              <User className="h-6 w-6 mt-1 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {messages.length === 0 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => sendMessage(action.prompt)}
              disabled={isStreaming}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问我任何竞拍问题..."
          disabled={isStreaming}
          maxLength={500}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  )
}
