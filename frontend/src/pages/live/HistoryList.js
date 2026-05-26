import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { formatPrice, formatTime } from '../../lib/format';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
const STATUS_CONFIG = {
    pending_payment: { variant: 'default', label: '待支付' },
    paid: { variant: 'secondary', label: '已支付' },
    cancelled: { variant: 'outline', label: '已取消' },
};
export default function HistoryList() {
    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/orders', { page, limit });
            const data = response.data;
            setOrders(data?.items || []);
            setTotal(data?.total || 0);
        }
        catch (err) {
            setError(err?.data?.message || err.message || '加载竞拍历史失败');
        }
        finally {
            setLoading(false);
        }
    }, [page, limit]);
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);
    const totalPages = Math.ceil(total / limit);
    return (_jsxs("div", { className: "min-h-screen bg-black flex flex-col", children: [_jsx("header", { className: "border-b border-white/10 bg-surface-secondary", children: _jsx("div", { className: "max-w-3xl mx-auto px-6 py-4", children: _jsx("h1", { className: "text-lg font-semibold text-white", children: "\u6211\u7684\u7ADE\u62CD" }) }) }), _jsxs("main", { className: "flex-1 max-w-3xl mx-auto px-6 py-6 w-full", children: [loading && (_jsx("div", { className: "space-y-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "bg-surface-card rounded-lg border border-white/10 p-4 animate-pulse", children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-10 h-10 bg-surface-secondary rounded-full" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-4 bg-surface-secondary rounded w-1/3" }), _jsx("div", { className: "h-3 bg-surface-secondary rounded w-1/2" })] })] }) }, i))) })), !loading && error && (_jsx("div", { className: "text-center py-16", children: _jsxs("div", { className: "bg-brand/10 border border-brand/30 rounded-lg px-6 py-4 inline-block", children: [_jsx("p", { className: "text-brand text-sm", children: error }), _jsx(Button, { variant: "link", onClick: fetchHistory, className: "mt-2 text-text-secondary", children: "\u91CD\u8BD5" })] }) })), !loading && !error && orders.length === 0 && (_jsxs("div", { className: "text-center py-24", children: [_jsx("div", { className: "text-5xl mb-4", children: "\uD83D\uDCED" }), _jsx("p", { className: "text-text-secondary", children: "\u8FD8\u6CA1\u6709\u53C2\u4E0E\u8FC7\u7ADE\u62CD" })] })), !loading && !error && orders.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "space-y-3", children: orders.map((order) => {
                                    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_payment;
                                    const isWin = order.status === 'pending_payment' || order.status === 'paid';
                                    return (_jsx(Card, { className: "bg-surface-card border-white/10 hover:border-white/20 transition-colors", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isWin ? 'bg-green-500/20' : 'bg-gray-500/20'}`, children: isWin ? (_jsx("svg", { className: "w-5 h-5 text-green-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) })) : (_jsx("svg", { className: "w-5 h-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-sm font-medium text-white truncate", children: ["\u5546\u54C1 #", order.product_id] }), _jsx(Badge, { variant: isWin ? 'default' : 'outline', className: `text-[10px] ${isWin ? 'bg-brand/20 text-brand border-brand/30' : 'text-text-tertiary border-white/10'}`, children: isWin ? 'WIN' : 'LOST' })] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx(Badge, { variant: statusCfg.variant, className: "text-[10px]", children: statusCfg.label }), _jsx("span", { className: "text-xs text-text-tertiary", children: formatTime(order.created_at) })] })] }), _jsxs("div", { className: "text-right flex-shrink-0", children: [_jsx("p", { className: "text-brand font-bold text-lg", children: formatPrice(order.final_price) }), _jsx("p", { className: "text-[10px] text-text-tertiary", children: "\u6210\u4EA4\u4EF7" })] })] }) }) }, order.id));
                                }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 mt-8", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, children: "\u4E0A\u4E00\u9875" }), Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (_jsx(Button, { variant: p === page ? 'default' : 'outline', size: "sm", onClick: () => setPage(p), className: p === page ? 'bg-brand hover:bg-brand-hover border-brand' : 'border-white/10', children: p }, p))), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page >= totalPages, children: "\u4E0B\u4E00\u9875" })] })), _jsxs("p", { className: "text-center text-text-tertiary text-xs mt-4", children: ["\u5171 ", total, " \u6761\u8BB0\u5F55"] })] }))] })] }));
}
