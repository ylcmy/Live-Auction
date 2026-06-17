import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Package,
  Gavel,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Users,
  Repeat,
  Target,
  Award,
  Clock,
} from 'lucide-react'
import type { MerchantInsightData } from '../../types/api'

interface InsightReportProps {
  data: MerchantInsightData
  aiText: string
  isStreaming: boolean
}

// 配色
const CHART_COLORS = {
  brand: '#FE2C55',
  brandLight: '#FF6B8A',
  accent: '#25F4EE',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  emerald: '#10B981',
  sky: '#0EA5E9',
  slate: '#64748B',
}

const PIE_COLORS = [
  CHART_COLORS.emerald,
  CHART_COLORS.brand,
  CHART_COLORS.amber,
  CHART_COLORS.sky,
  CHART_COLORS.violet,
]

function formatCurrency(n: number): string {
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`
  return `¥${n.toFixed(0)}`
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

// KPI 卡片
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Package
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// 图表卡片容器
function ChartCard({
  title,
  subtitle,
  children,
  height = 280,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  height?: number
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}

// 自定义 Tooltip
function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-medium text-slate-700 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="text-slate-600">
          <span
            className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// 解析 **加粗** 标记并渲染为高亮 span
function renderHighlightedText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2)
      return (
        <mark
          key={i}
          className="bg-brand/8 text-brand font-semibold px-1 py-0.5 rounded border-b border-brand/30"
        >
          {inner}
        </mark>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function InsightReport({ data, aiText, isStreaming }: InsightReportProps) {
  // 1. KPI 数据
  const soldRate = data.auctionPerformance.completedCount > 0
    ? data.auctionPerformance.soldCount / data.auctionPerformance.completedCount
    : 0

  // 2. 每日收入折线图数据
  const dailyRevenueData = useMemo(
    () =>
      data.revenueAnalysis.dailyRevenue.map((r) => ({
        date: r.date.slice(5), // MM-DD
        amount: Number(r.amount),
      })),
    [data.revenueAnalysis.dailyRevenue],
  )

  // 3. 拍卖表现饼图数据
  const auctionPieData = useMemo(
    () => [
      { name: '已售出', value: data.auctionPerformance.soldCount },
      { name: '流拍', value: data.auctionPerformance.unsoldCount },
    ],
    [data.auctionPerformance],
  )

  // 4. 竞价时段柱状图数据
  const hourlyData = useMemo(() => {
    const hours = Object.keys(data.biddingHeat.hourlyDistribution).sort(
      (a, b) => Number(a) - Number(b),
    )
    return hours.map((h) => ({
      hour: `${h}:00`,
      bids: data.biddingHeat.hourlyDistribution[h],
    }))
  }, [data.biddingHeat.hourlyDistribution])

  // 5. Top 商品柱状图数据
  const topProductsData = useMemo(
    () =>
      data.revenueAnalysis.topProducts.map((p) => ({
        name: p.name.length > 8 ? p.name.slice(0, 8) + '…' : p.name,
        fullName: p.name,
        revenue: Number(p.revenue),
      })),
    [data.revenueAnalysis.topProducts],
  )

  // 6. AI 文本分段
  const aiSections = useMemo(() => {
    if (!aiText) return []
    // 按【】标题分段
    const sections = aiText
      .split(/(?=【[^】]+】)/)
      .map((s) => s.trim())
      .filter(Boolean)
    return sections
  }, [aiText])

  return (
    <div className="space-y-5">
      {/* ====== KPI 卡片区 ====== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Package}
          label="商品总数"
          value={String(data.overview.totalProducts)}
          sub={`活跃拍卖 ${data.overview.activeAuctions} 场`}
          color={CHART_COLORS.sky}
        />
        <KpiCard
          icon={Gavel}
          label="完成拍卖"
          value={String(data.auctionPerformance.completedCount)}
          sub={`平均出价 ${data.auctionPerformance.avgBidCount.toFixed(1)} 次`}
          color={CHART_COLORS.violet}
        />
        <KpiCard
          icon={ShoppingCart}
          label="成交订单"
          value={String(data.overview.totalOrders)}
          sub={`转化率 ${formatPercent(data.revenueAnalysis.conversionRate)}`}
          color={CHART_COLORS.emerald}
        />
        <KpiCard
          icon={DollarSign}
          label="总收入"
          value={formatCurrency(data.overview.totalRevenue)}
          sub={`溢价率 ${formatPercent(data.auctionPerformance.avgPremiumRate)}`}
          color={CHART_COLORS.brand}
        />
      </div>

      {/* ====== 图表区 ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 每日收入趋势 */}
        <ChartCard
          title="近 30 天收入趋势"
          subtitle="每日成交金额走势"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyRevenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.brand} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
              <Area
                type="monotone"
                dataKey="amount"
                name="收入"
                stroke={CHART_COLORS.brand}
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 拍卖成交分布 */}
        <ChartCard
          title="拍卖成交分布"
          subtitle={`成交率 ${formatPercent(soldRate)}`}
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={auctionPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}`}
                labelLine={false}
              >
                {auctionPieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 竞价时段分布 */}
        <ChartCard
          title="竞价时段分布"
          subtitle={`高峰时段 ${data.biddingHeat.peakHours.map((h) => `${h}:00`).join(' / ')}`}
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                interval={2}
              />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bids" name="出价数" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top 商品收入 */}
        <ChartCard
          title="Top 5 商品收入"
          subtitle="按成交金额排序"
          height={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topProductsData}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748B' }}
                width={80}
              />
              <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
              <Bar
                dataKey="revenue"
                name="收入"
                fill={CHART_COLORS.violet}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ====== 用户行为指标 ====== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label="独立出价人"
          value={String(data.biddingHeat.uniqueBidders)}
          color={CHART_COLORS.accent}
        />
        <KpiCard
          icon={Repeat}
          label="复购出价人"
          value={String(data.biddingHeat.repeatBidders)}
          sub={`占比 ${data.biddingHeat.uniqueBidders > 0 ? formatPercent(data.biddingHeat.repeatBidders / data.biddingHeat.uniqueBidders) : '0%'}`}
          color={CHART_COLORS.amber}
        />
        <KpiCard
          icon={Target}
          label="成交率"
          value={formatPercent(soldRate)}
          sub={`${data.auctionPerformance.soldCount}/${data.auctionPerformance.completedCount}`}
          color={CHART_COLORS.emerald}
        />
        <KpiCard
          icon={Award}
          label="平均溢价率"
          value={formatPercent(data.auctionPerformance.avgPremiumRate)}
          color={CHART_COLORS.brand}
        />
      </div>

      {/* ====== AI 文字洞察区 ====== */}
      {aiText && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">AI 深度洞察</h3>
            {isStreaming && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
            )}
          </div>

          <div className="space-y-4">
            {aiSections.map((section, idx) => {
              const titleMatch = section.match(/【([^】]+)】/)
              const title = titleMatch?.[1] ?? ''
              const body = titleMatch ? section.slice(titleMatch[0].length).trim() : section

              // 为不同段落选图标
              const sectionIcons: Record<string, typeof Clock> = {
                '运营概览': TrendingUp,
                '拍卖表现解读': Gavel,
                '竞价热度洞察': Clock,
                '收入与转化分析': DollarSign,
                '行动建议': Target,
              }
              const SectionIcon = sectionIcons[title] ?? TrendingUp

              return (
                <div key={idx} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mt-0.5">
                    <SectionIcon className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {title && (
                      <p className="text-xs font-semibold text-slate-900 mb-1">{title}</p>
                    )}
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {renderHighlightedText(body)}
                      {isStreaming && idx === aiSections.length - 1 && (
                        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-brand rounded-sm animate-pulse align-middle" />
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
