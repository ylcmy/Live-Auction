import { useState, useRef, useCallback, useEffect } from 'react'
import { useToast } from '@/design-system/hooks/use-toast'
import { streamAIResponse } from '@/lib/ai-client'
import StreamingMarkdown from '@/components/ai/StreamingMarkdown'
import { Send, Bot, User, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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

const STICK_THRESHOLD_PX = 48

export default function AIChatPanel({ roomId }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [stuck, setStuck] = useState(true)
  const [unread, setUnread] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastCountRef = useRef(0)
  const { toast } = useToast()

  // Stick-to-bottom detection
  const checkStuck = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setStuck(scrollHeight - (scrollTop + clientHeight) <= STICK_THRESHOLD_PX)
  }, [])

  // Auto-scroll on new content when stuck
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof el.scrollTo !== 'function') return
    const diff = messages.length - lastCountRef.current
    lastCountRef.current = messages.length

    // Also react to content updates (streaming) — check last message content length
    if (stuck) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      setUnread(0)
    } else if (diff > 0) {
      setUnread((n) => n + diff)
    }
  }, [messages, stuck])

  // During streaming, also follow content growth when stuck
  const lastContentLenRef = useRef(0)
  useEffect(() => {
    if (!isStreaming) {
      lastContentLenRef.current = 0
      return
    }
    const last = messages[messages.length - 1]
    const len = last?.content?.length ?? 0
    if (stuck && len > lastContentLenRef.current) {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
    lastContentLenRef.current = len
  }, [messages, isStreaming, stuck])

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el || typeof el.scrollTo !== 'function') return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setUnread(0)
    setStuck(true)
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMessage: ChatMessage = { role: 'user', content: text.trim() }
      setMessages((prev) => [...prev, userMessage])
      setInput('')
      setIsStreaming(true)
      setStuck(true) // sending a message implies user wants to see the reply

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
          if (chunk.error) {
            throw new Error(chunk.content || 'AI 服务暂时不可用')
          }
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
        const msg = (err as Error).message || '暂时无法回答，请稍后再试'
        toast({
          title: 'AI 助手提示',
          description: msg,
          variant: 'destructive',
        })
        setMessages((prev) => prev.filter((m) => m.content !== ''))
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, messages, roomId, toast]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900 text-slate-100">
      {/* Messages scroll area — the only flexible region */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={checkStuck}
          role="log"
          aria-live="polite"
          aria-label="AI 对话记录"
          className="absolute inset-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3"
          style={{ scrollbarWidth: 'thin' }}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-brand/30 to-accent/30 blur-2xl rounded-full" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-glow-brand-lg">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
              </div>
              <p className="text-base font-semibold text-white mb-1">AI 竞拍助手</p>
              <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
                我可以帮你分析当前竞拍情况，给出出价建议
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 mt-0.5 shrink-0 rounded-full bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-glow-brand">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-brand to-brand-hover text-white shadow-md shadow-brand/20 rounded-tr-md'
                    : 'bg-white/8 text-slate-100 border border-white/10 backdrop-blur-sm rounded-tl-md'
                }`}
              >
                {msg.content ? (
                  msg.role === 'assistant' ? (
                    <StreamingMarkdown
                      content={msg.content}
                      isStreaming={isStreaming && index === messages.length - 1}
                      theme="dark"
                    />
                  ) : (
                    <span className="whitespace-pre-line">{msg.content}</span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs">思考中...</span>
                  </span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 mt-0.5 shrink-0 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-slate-300" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Top fade hint */}
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-4 pointer-events-none bg-gradient-to-b from-slate-900 to-transparent z-10"
        />

        {/* Floating "new messages" pill */}
        <AnimatePresence>
          {!stuck && unread > 0 && (
            <motion.button
              key="unread"
              type="button"
              onClick={jumpToBottom}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="absolute right-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-white bg-gradient-to-r from-brand to-brand-hover shadow-lg shadow-brand/30 border border-white/20 hover:from-brand-hover hover:to-brand active:scale-95 transition-all"
              aria-label={`${unread} 条新消息，点击跳到底部`}
            >
              <ChevronDown className="w-3 h-3" />
              <span>{unread} 条新消息</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Quick actions — only when no messages yet */}
      {messages.length === 0 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto flex-shrink-0">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => sendMessage(action.prompt)}
              disabled={isStreaming}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-slate-200 hover:bg-white/10 hover:text-white hover:border-white/25 transition-colors disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input bar — fixed at bottom, never scrolls */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3 border-t border-white/10 bg-slate-900/95 flex-shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问我任何竞拍问题..."
          disabled={isStreaming}
          maxLength={500}
          className="flex-1 h-10 rounded-full bg-white/5 border border-white/15 px-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20 transition-all"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-hover text-white shadow-glow-brand flex items-center justify-center hover:from-brand-hover hover:to-brand active:scale-95 transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
          aria-label="发送"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  )
}
