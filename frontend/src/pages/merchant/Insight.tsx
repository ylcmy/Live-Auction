import { useState, useRef, useCallback, useEffect } from 'react'
import { useToast } from '@/design-system/hooks/use-toast'
import { InsightCharts, AIInsightText } from '@/components/ai/InsightReport'
import AILoadingSkeleton from '@/components/ai/AILoadingSkeleton'
import { streamAIGetResponse } from '@/lib/ai-client'
import api from '@/services/api'
import {
  RefreshCw,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  BarChart3,
  Bot,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ApiResponse, MerchantInsightData } from '@/types/api'

const TIME_RANGES = [
  { label: '7天', value: 7 },
  { label: '14天', value: 14 },
  { label: '30天', value: 30 },
  { label: '90天', value: 90 },
] as const

export default function Insight() {
  // ====== 图表区状态（独立） ======
  const [insightData, setInsightData] = useState<MerchantInsightData | null>(null)
  const [days, setDays] = useState<number>(30)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // ====== AI 洞察区状态（独立） ======
  const [aiText, setAiText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [hasAIContent, setHasAIContent] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const { toast } = useToast()

  // 图表数据加载函数
  const loadChartData = useCallback(
    async (selectedDays: number) => {
      setIsLoadingData(true)
      setDataError(null)
      try {
        const res = await api.get<ApiResponse<MerchantInsightData>>(
          `/ai/insight/data?days=${selectedDays}`,
        )
        if (res.code === 0 && res.data) {
          setInsightData(res.data)
        } else {
          throw new Error(res.message || '数据获取失败')
        }
      } catch (err) {
        const message = (err as Error).message || '数据获取失败'
        setDataError(message)
      } finally {
        setIsLoadingData(false)
      }
    },
    [],
  )

  // 页面加载时自动拉取图表数据
  useEffect(() => {
    loadChartData(days)
  }, [days, loadChartData])

  // AI 洞察生成函数（独立于图表）
  const generateAIInsight = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    setAiText('')
    setIsStreaming(true)
    setAiError(null)
    setHasAIContent(false)

    try {
      for await (const chunk of streamAIGetResponse(
        `/api/ai/insight?days=${days}`,
        controller.signal,
      )) {
        if (chunk.error) {
          throw new Error(chunk.content || 'AI 服务暂时不可用')
        }
        if (chunk.content) {
          setAiText((prev) => prev + chunk.content)
          setHasAIContent(true)
        }
        if (chunk.done) {
          break
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = (err as Error).message || 'AI 暂时不可用'
      setAiError(message)
      toast({
        title: 'AI 服务提示',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [days, toast])

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-glow-brand">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI 数据洞察</h1>
          <p className="text-xs text-slate-500 mt-0.5">数据可视化图表 + AI 深度分析</p>
        </div>
      </div>

      {/* ====== 图表区（独立） ====== */}
      <div className="mb-8">
        {/* 图表区头部：时间段选择器 + 刷新按钮 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">数据图表</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* 时间段选择器 */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDays(range.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    days === range.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            {/* 刷新图表数据 */}
            <button
              onClick={() => loadChartData(days)}
              disabled={isLoadingData}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingData ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {/* 图表内容 */}
        <AnimatePresence mode="wait">
          {isLoadingData && !insightData && (
            <motion.div
              key="chart-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm"
            >
              <AILoadingSkeleton />
            </motion.div>
          )}

          {dataError && !insightData && (
            <motion.div
              key="chart-error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col items-center justify-center py-12 px-6 border border-slate-200 rounded-2xl bg-white"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">数据加载失败</p>
              <p className="text-xs text-slate-500 mb-4">{dataError}</p>
              <button
                onClick={() => loadChartData(days)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 active:scale-95 transition-all"
              >
                <RefreshCw className="h-3 w-3" />
                重试
              </button>
            </motion.div>
          )}

          {insightData && (
            <motion.div
              key="chart-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isLoadingData && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                  <span className="text-xs text-slate-400">正在刷新数据...</span>
                </div>
              )}
              <InsightCharts data={insightData} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ====== AI 洞察区（独立） ====== */}
      <div>
        {/* AI 洞察区头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">AI 深度洞察</h2>
            <span className="text-xs text-slate-400">基于近 {days} 天数据</span>
          </div>
          <button
            onClick={generateAIInsight}
            disabled={isStreaming}
            className="inline-flex items-center gap-2 h-8 px-4 rounded-full bg-gradient-to-r from-brand to-brand-hover text-white text-xs font-medium shadow-glow-brand hover:from-brand-hover hover:to-brand active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3 w-3 ${isStreaming ? 'animate-spin' : ''}`} />
            {hasAIContent ? '重新生成' : '生成分析'}
          </button>
        </div>

        {/* AI 洞察内容 */}
        <AnimatePresence mode="wait">
          {!hasAIContent && !isStreaming && !aiError && (
            <motion.div
              key="ai-empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center py-10 px-6 border border-slate-200 rounded-2xl bg-white"
            >
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-brand/15 to-accent/15 blur-2xl rounded-full" />
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-glow-brand">
                  <Bot className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">AI 深度分析</p>
              <p className="text-xs text-slate-500 text-center max-w-sm mb-4">
                点击「生成分析」，AI 将基于图表数据生成运营解读和优化建议
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  趋势解读
                </span>
                <span className="flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  行动建议
                </span>
              </div>
            </motion.div>
          )}

          {isStreaming && !hasAIContent && (
            <motion.div
              key="ai-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="text-xs text-slate-500 font-medium">AI 正在生成分析...</span>
              </div>
              <AILoadingSkeleton />
            </motion.div>
          )}

          {aiError && !hasAIContent && (
            <motion.div
              key="ai-error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col items-center justify-center py-10 px-6 border border-slate-200 rounded-2xl bg-white"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">生成失败</p>
              <p className="text-xs text-slate-500 mb-4 text-center max-w-sm">{aiError}</p>
              <button
                onClick={generateAIInsight}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 active:scale-95 transition-all"
              >
                <RefreshCw className="h-3 w-3" />
                重试
              </button>
            </motion.div>
          )}

          {hasAIContent && (
            <motion.div
              key="ai-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isStreaming && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                  </span>
                  <span className="text-xs text-slate-500 font-medium">AI 正在生成分析...</span>
                </div>
              )}
              <AIInsightText aiText={aiText} isStreaming={isStreaming} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
