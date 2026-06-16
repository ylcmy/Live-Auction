import { useRef, useEffect, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react'

interface StreamingMarkdownProps {
  content: string
  isStreaming: boolean
  onComplete?: () => void
}

/**
 * Detect semantic intent of a heading by keyword so we can render
 * decorative accent bars + icons for common report sections.
 */
function detectSectionIntent(text: string): {
  icon: LucideIcon | null
  accent: string
  iconColor: string
} {
  const lower = text.toLowerCase()
  if (/(趋势|走势|增长|下降|变化|trend)/.test(lower)) {
    const isDown = /下降|跌|减|负|下滑/.test(text)
    return {
      icon: isDown ? TrendingDown : TrendingUp,
      accent: isDown ? 'border-l-red-400' : 'border-l-emerald-400',
      iconColor: isDown ? 'text-red-500' : 'text-emerald-500',
    }
  }
  if (/(风险|问题|警告|注意|隐患|risk|warning)/.test(lower)) {
    return {
      icon: AlertTriangle,
      accent: 'border-l-amber-400',
      iconColor: 'text-amber-500',
    }
  }
  if (/(建议|优化|改进|策略|推荐|suggestion|advice)/.test(lower)) {
    return {
      icon: Lightbulb,
      accent: 'border-l-violet-400',
      iconColor: 'text-violet-500',
    }
  }
  if (/(总结|结论|概述|小结|summary|conclusion)/.test(lower)) {
    return {
      icon: CheckCircle2,
      accent: 'border-l-brand',
      iconColor: 'text-brand',
    }
  }
  if (/(说明|备注|注意|info|note)/.test(lower)) {
    return {
      icon: Info,
      accent: 'border-l-sky-400',
      iconColor: 'text-sky-500',
    }
  }
  return { icon: null, accent: 'border-l-slate-300', iconColor: '' }
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
      <div className="text-slate-700 text-sm leading-relaxed space-y-4">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-slate-900 mt-6 mb-3 first:mt-0 flex items-center gap-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => {
              const text = String(children)
              const { icon: Icon, accent, iconColor } = detectSectionIntent(text)
              return (
                <h2
                  className={`text-base font-semibold text-slate-900 mt-6 mb-3 first:mt-0 pl-3 border-l-4 ${accent} flex items-center gap-2`}
                >
                  {Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
                  <span>{children}</span>
                </h2>
              )
            },
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2 flex items-center gap-1.5">
                <span className="w-1 h-4 rounded-full bg-brand/40" />
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-sm font-medium text-slate-700 mt-3 mb-1.5">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-relaxed text-slate-600 my-2">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="space-y-1.5 my-3 pl-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="space-y-1.5 my-3 pl-1 list-decimal list-inside marker:text-slate-400 marker:font-medium">
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => {
              const isOrdered = (props as unknown as { ordered?: boolean }).ordered
              if (isOrdered) {
                return (
                  <li className="text-sm text-slate-600 pl-1 leading-relaxed">
                    {children}
                  </li>
                )
              }
              return (
                <li className="text-sm text-slate-600 flex items-start gap-2 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand/50 flex-shrink-0" />
                  <span className="flex-1">{children}</span>
                </li>
              )
            },
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-900 bg-brand/5 px-1 py-0.5 rounded">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic text-slate-500">{children}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-4 pl-4 pr-3 py-3 bg-slate-50 border-l-4 border-slate-200 rounded-r-lg">
                <div className="text-sm text-slate-600 [&>p]:my-0">{children}</div>
              </blockquote>
            ),
            hr: () => (
              <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            ),
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm border-collapse">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-slate-50">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 first:rounded-tl-xl last:rounded-tr-xl">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 text-slate-600 border-b border-slate-100 [&:last-child>tr:last-child]:border-b-0">
                {children}
              </td>
            ),
            code: ({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) => {
              const isBlock = className?.includes('language-')
              if (isBlock) {
                return (
                  <code className="block" {...props}>
                    {children}
                  </code>
                )
              }
              return (
                <code className="px-1.5 py-0.5 rounded bg-slate-100 text-brand text-[0.85em] font-mono" {...props}>
                  {children}
                </code>
              )
            },
            pre: ({ children }) => (
              <pre className="my-3 p-3 rounded-xl bg-slate-900 text-slate-100 text-xs overflow-x-auto">
                {children}
              </pre>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:text-brand-hover underline decoration-brand/30 underline-offset-2 transition-colors"
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
        {isStreaming && (
          <span
            className="inline-block w-2 h-4 ml-0.5 bg-brand rounded-sm animate-pulse align-middle"
            aria-label="正在生成"
          />
        )}
      </div>
    </div>
  )
}
