import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingMarkdownProps {
  content: string
  isStreaming: boolean
  onComplete?: () => void
}

export default function StreamingMarkdown({
  content,
  isStreaming,
  onComplete,
}: StreamingMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [content])

  // 流式结束回调
  useEffect(() => {
    if (!isStreaming && content && onComplete) {
      onComplete()
    }
  }, [isStreaming, content, onComplete])

  return (
    <div ref={containerRef} className="overflow-y-auto max-h-full">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
        {isStreaming && (
          <span
            className="inline-block w-2 h-4 ml-1 bg-gray-900 dark:bg-gray-100 animate-pulse align-middle"
            aria-label="正在生成"
          />
        )}
      </div>
    </div>
  )
}
