import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion, AnimatePresence } from 'framer-motion';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../../design-system/components/ui/avatar';
import { Badge } from '../../design-system/components/ui/badge';
export default function Leaderboard() {
    const { leaderboard, myRank } = useAuctionStore();
    if (leaderboard.length === 0) {
        return (_jsx("div", { className: "text-center py-4", children: _jsx("p", { className: "text-text-tertiary text-sm", children: "\u6682\u65E0\u51FA\u4EF7\uFF0C\u5FEB\u6765\u62A2\u7B2C\u4E00\uFF01" }) }));
    }
    const rankMedals = ['🥇', '🥈', '🥉'];
    return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between px-1 py-1 text-xs text-text-tertiary", children: [_jsx("span", { children: "\u6392\u540D" }), _jsx("span", { children: "\u51FA\u4EF7\u8005" }), _jsx("span", { children: "\u91D1\u989D" })] }), _jsx(ScrollArea, { className: "max-h-60", children: _jsx("div", { className: "space-y-1 pr-1", children: _jsx(AnimatePresence, { children: leaderboard.slice(0, 10).map((entry) => (_jsxs(motion.div, { layout: true, initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 }, transition: { type: 'spring', stiffness: 300, damping: 25 }, className: `flex items-center justify-between px-3 py-2 rounded-lg text-sm ${entry.isCurrentUser
                                ? 'bg-brand/10 border border-brand/30'
                                : 'bg-surface-elevated border border-white/5'}`, children: [_jsx("span", { className: "w-8 text-center font-semibold", children: entry.rank <= 3 ? rankMedals[entry.rank - 1] : `#${entry.rank}` }), _jsxs("div", { className: "flex-1 flex items-center gap-2 min-w-0 ml-2", children: [_jsx(Avatar, { className: "h-6 w-6", children: _jsx(AvatarFallback, { className: "text-[10px] bg-surface-secondary text-text-secondary", children: entry.userNickname.charAt(0) }) }), _jsx("span", { className: `truncate text-sm ${entry.isCurrentUser ? 'text-brand font-medium' : 'text-text-secondary'}`, children: entry.userNickname }), entry.isCurrentUser && (_jsx(Badge, { variant: "outline", className: "text-[10px] px-1 py-0 border-brand/30 text-brand", children: "\u4F60" }))] }), _jsx("span", { className: `font-semibold text-sm ${entry.isCurrentUser ? 'text-brand' : 'text-white'}`, children: formatPrice(entry.amount) })] }, entry.userId))) }) }) }), myRank && myRank > 10 && (_jsx("div", { className: "px-3 py-2 rounded-lg bg-brand/10 border border-brand/30 text-sm mt-2 text-center", children: _jsxs("span", { className: "text-brand", children: ["\u4F60\u7684\u6392\u540D: #", myRank] }) }))] }));
}
