import { useState, useRef, useCallback } from 'react'
import { Button } from '@/design-system/components/ui/button'
import { useToast } from '@/design-system/hooks/use-toast'
import StreamingMarkdown from '@/components/ai/StreamingMarkdown'
import AILoadingSkeleton from '@/components/ai/AILoadingSkeleton'
import { streamAIGetResponse } from '@/lib/ai-client'
import { RefreshCw, BarChart3 } from 'lucide-react'

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">AI 数据洞察</h1>
        </div>
        <Button
          onClick={generateInsight}
          disabled={isStreaming}
          variant="outline"
          size="sm"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isStreaming ? 'animate-spin' : ''}`}
          />
          {hasContent ? '重新生成' : '生成报告'}
        </Button>
      </div>

      {!hasContent && !isLoading && !error && (
        <div className="text-center py-20">
          <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg mb-2">
            点击"生成报告"，AI 将基于您的运营数据生成洞察分析
          </p>
          <Button onClick={generateInsight} className="mt-4">
            生成报告
          </Button>
        </div>
      )}

      {isLoading && <AILoadingSkeleton />}

      {error && !hasContent && (
        <div className="text-center py-20">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={generateInsight} variant="outline">
            重试
          </Button>
        </div>
      )}

      {hasContent && (
        <div className="border rounded-lg p-6 bg-card">
          <StreamingMarkdown content={content} isStreaming={isStreaming} />
        </div>
      )}
    </div>
  )
}
