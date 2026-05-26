import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatPrice } from '../../lib/format';
import { Card } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';
const STATUS_CONFIG = {
    draft: { variant: 'outline', label: '草稿' },
    pending: { variant: 'secondary', label: '待上架' },
    active: { variant: 'default', label: '竞拍中' },
    ended: { variant: 'secondary', label: '已结束' },
    cancelled: { variant: 'destructive', label: '已取消' },
    unsold: { variant: 'outline', label: '未售出' },
};
export default function ProductCard({ product, currentPrice, onClick }) {
    const statusCfg = STATUS_CONFIG[product.status] || STATUS_CONFIG.draft;
    return (_jsxs(Card, { onClick: onClick, className: "bg-surface-card border-white/10 overflow-hidden cursor-pointer hover:border-white/20 hover:bg-surface-elevated transition-all duration-200 group", children: [_jsxs("div", { className: "aspect-video bg-surface-secondary relative overflow-hidden", children: [product.imageUrl ? (_jsx("img", { src: product.imageUrl, alt: product.name, className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center", children: _jsx("svg", { className: "w-12 h-12 text-text-tertiary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }) })), _jsx(Badge, { variant: statusCfg.variant, className: `absolute top-2 right-2 text-xs font-medium ${product.status === 'active' ? 'bg-brand text-white hover:bg-brand border-0' : ''}`, children: statusCfg.label })] }), _jsxs("div", { className: "p-4 space-y-2", children: [_jsx("h3", { className: "text-white font-medium text-sm truncate", children: product.name }), product.description && (_jsx("p", { className: "text-text-tertiary text-xs line-clamp-2", children: product.description })), product.category && (_jsx(Badge, { variant: "secondary", className: "bg-surface-secondary text-text-tertiary border-0 text-xs", children: product.category })), currentPrice !== undefined && currentPrice !== null && product.status === 'active' && (_jsxs("div", { className: "flex items-center justify-between pt-2 border-t border-white/5", children: [_jsx("span", { className: "text-text-tertiary text-xs", children: "\u5F53\u524D\u51FA\u4EF7" }), _jsx("span", { className: "text-brand font-semibold text-sm", children: formatPrice(currentPrice) })] }))] })] }));
}
