export default function AILoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-label="AI 加载中" role="status">
      {/* Title bar */}
      <div className="space-y-2">
        <div className="h-5 bg-slate-200 rounded-lg w-2/5" />
        <div className="h-3 bg-slate-100 rounded w-1/4" />
      </div>

      {/* Paragraph 1 */}
      <div className="space-y-2">
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-11/12" />
        <div className="h-3 bg-slate-200 rounded w-4/5" />
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-3 gap-3 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="h-3 bg-slate-200 rounded w-2/3" />
            <div className="h-6 bg-slate-200 rounded w-1/2" />
          </div>
        ))}
      </div>

      {/* Paragraph 2 */}
      <div className="space-y-2">
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-5/6" />
        <div className="h-3 bg-slate-200 rounded w-3/4" />
      </div>

      {/* List items */}
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="h-3 bg-slate-200 rounded flex-1" style={{ maxWidth: `${85 - i * 12}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
