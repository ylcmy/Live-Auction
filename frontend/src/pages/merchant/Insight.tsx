import { useState, useRef, useCallback } from 'react'
import { useToast } from '@/design-system/hooks/use-toast'
import StreamingMarkdown from '@/components/ai/StreamingMarkdown'
import AILoadingSkeleton from '@/components/ai/AILoadingSkeleton'
import { streamAIGetResponse } from '@/lib/ai-client'
import { RefreshCw, Sparkles, AlertCircle, FileText, TrendingUp, Lightbulb } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Insight() {
  const [content, setContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasContent, setHasContent] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const { toast } = useToast()

  const generateInsight = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    setContent('')
    setIsStreaming(true)
    setIsLoading(true)
    setError(null)
    setHasContent(false)

    try {
      for await (const chunk of streamAIGetResponse(
        '/api/ai/insight',
        controller.signal
      )) {
        if (chunk.error) {
          throw new Error(chunk.content || 'AI 服务暂时不可用')
        }
        if (chunk.content) {
          setContent((prev) => prev + chunk.content)
          setHasContent(true)
          setIsLoading(false)
        }
        if (chunk.done) {
          break
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = (err as Error).message || 'AI 暂时不可用'
      setError(message)
      toast({
        title: 'AI 服务提示',
        description: 'AI 暂时不可用，已为您展示基础统计数据',
        variant: 'destructive',
      })
    } finally {
      setIsStreaming(false)
      setIsLoading(false)
      abortRef.current = null
    }
  }, [toast])

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-glow-brand">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI 数据洞察</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              基于您的运营数据生成智能分析报告
            </p>
          </div>
        </div>
        <button
          onClick={generateInsight}
          disabled={isStreaming}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-gradient-to-r from-brand to-brand-hover text-white text-sm font-medium shadow-glow-brand hover:from-brand-hover hover:to-brand active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isStreaming ? 'animate-spin' : ''}`} />
          {hasContent ? '重新生成' : '生成报告'}
        </button>
      </div>

      {/* Content area */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {/* Empty state */}
          {!hasContent && !isLoading && !error && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-accent/20 blur-3xl rounded-full" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-glow-brand-lg">
                  <Sparkles className="h-9 w-9 text-white" />
                </div>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                一键生成 AI 洞察报告
              </h2>
              <p className="text-sm text-slate-500 text-center max-w-md mb-6 leading-relaxed">
                AI 将分析您的商品、竞拍、订单数据，生成运营趋势、热销品类、转化漏斗等深度洞察
              </p>

              {/* Feature highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mb-8">
                {[
                  { icon: TrendingUp, title: '趋势分析', desc: '收入与流量走势' },
                  { icon: FileText, title: '报告导出', desc: '结构化 Markdown' },
                  { icon: Lightbulb, title: '智能建议', desc: '优化运营策略' },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="flex flex-col items-center text-center p-4 rounded-xl bg-white border border-slate-200 shadow-sm"
                  >
                    <f.icon className="h-5 w-5 text-brand mb-2" />
                    <p className="text-sm font-medium text-slate-800">{f.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={generateInsight}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-gradient-to-r from-brand to-brand-hover text-white text-sm font-medium shadow-glow-brand hover:from-brand-hover hover:to-brand active:scale-95 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                立即生成报告
              </button>
            </motion.div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm"
            >
              <AILoadingSkeleton />
            </motion.div>
          )}

          {/* Error state */}
          {error && !hasContent && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">生成失败</p>
              <p className="text-xs text-slate-500 mb-5 text-center max-w-sm">{error}</p>
              <button
                onClick={generateInsight}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </button>
            </motion.div>
          )}

          {/* Content */}
          {hasContent && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              {/* Streaming indicator bar */}
              {isStreaming && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                  </span>
                  <span className="text-xs text-slate-500 font-medium">AI 正在生成报告...</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm">
                <StreamingMarkdown content={content} isStreaming={isStreaming} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
