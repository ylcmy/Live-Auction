import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import { formatPrice } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { Button } from '../../design-system/components/ui/button';
import { Badge } from '../../design-system/components/ui/badge';
import { Avatar, AvatarFallback } from '../../design-system/components/ui/avatar';
export default function AuctionResult({ result, userParticipated, userOvertaken = false, onDismiss }) {
    const { user } = useAuthStore();
    const [isPaying, setIsPaying] = useState(false);
    const [paid, setPaid] = useState(false);
    const [payError, setPayError] = useState(null);
    const isWinner = result.winner && user && result.winner.userId === user.id;
    const handlePay = async () => {
        if (!result.orderId)
            return;
        setIsPaying(true);
        setPayError(null);
        try {
            const response = await api.post(`/orders/${result.orderId}/pay`);
            if (response.code === 0) {
                setPaid(true);
            }
            else {
                setPayError(response.message || '支付失败');
            }
        }
        catch (err) {
            setPayError(err?.data?.message || err.message || '支付失败');
        }
        finally {
            setIsPaying(false);
        }
    };
    // Non-participant view
    if (!userParticipated && !isWinner) {
        return (_jsx(Card, { className: "bg-surface-card border-white/10", children: _jsxs(CardContent, { className: "p-6 text-center", children: [_jsx("div", { className: "text-5xl mb-4", children: "\uD83D\uDD14" }), _jsx("h2", { className: "text-xl font-bold text-white mb-2", children: "\u7ADE\u62CD\u7ED3\u675F" }), result.winner ? (_jsxs("p", { className: "text-text-secondary text-sm", children: ["\u7531 ", _jsx("span", { className: "text-brand font-semibold", children: result.winner.userNickname }), ' ', "\u4EE5 ", formatPrice(result.winner.finalPrice), " \u6210\u4EA4"] })) : (_jsx("p", { className: "text-text-secondary text-sm", children: "\u65E0\u4EBA\u51FA\u4EF7\uFF0C\u7ADE\u62CD\u6D41\u62CD" })), onDismiss && (_jsx(Button, { onClick: onDismiss, className: "mt-6 bg-brand hover:bg-brand-hover text-white", children: "\u8FD4\u56DE\u76F4\u64AD\u95F4" }))] }) }));
    }
    // Winner view
    if (isWinner && result.winner) {
        if (paid) {
            return (_jsx(Card, { className: "bg-surface-card border-white/10", children: _jsxs(CardContent, { className: "p-6 text-center", children: [_jsx(motion.div, { initial: { scale: 0 }, animate: { scale: 1 }, transition: { type: 'spring', stiffness: 200, damping: 15 }, children: _jsx("div", { className: "text-6xl mb-4", children: "\uD83C\uDF89" }) }), _jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3 }, children: [_jsx("h2", { className: "text-xl font-bold text-white mb-2", children: "\u652F\u4ED8\u6210\u529F" }), _jsx("p", { className: "text-brand text-2xl font-bold mb-2", children: formatPrice(result.winner.finalPrice) }), _jsx("p", { className: "text-text-tertiary text-sm", children: "\u606D\u559C\u60A8\u6210\u529F\u62CD\u5F97\u6B64\u5546\u54C1" })] }), onDismiss && (_jsx(Button, { onClick: onDismiss, className: "mt-6 bg-brand hover:bg-brand-hover text-white", children: "\u8FD4\u56DE\u76F4\u64AD\u95F4" }))] }) }));
        }
        return (_jsx(Card, { className: "bg-surface-card border-brand/20", children: _jsxs(CardContent, { className: "p-6 text-center", children: [_jsx(motion.div, { initial: { scale: 0 }, animate: { scale: 1 }, transition: { type: 'spring', stiffness: 200, damping: 15 }, children: _jsx("div", { className: "text-6xl mb-4", children: "\uD83C\uDFC6" }) }), _jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3 }, children: [_jsx("h2", { className: "text-xl font-bold text-white mb-1", children: "\u606D\u559C\u4E2D\u6807\uFF01" }), _jsx("p", { className: "text-text-secondary text-sm mb-4", children: "\u60A8\u5DF2\u6210\u529F\u62CD\u5F97\u6B64\u5546\u54C1" }), _jsxs("div", { className: "bg-surface-elevated rounded-xl p-6 mb-6 inline-block", children: [_jsx("p", { className: "text-text-tertiary text-xs mb-1", children: "\u6210\u4EA4\u4EF7" }), _jsx("p", { className: "text-brand text-4xl font-bold", children: formatPrice(result.winner.finalPrice) })] }), _jsxs("div", { className: "space-y-3", children: [payError && _jsx("p", { className: "text-brand text-xs", children: payError }), _jsx(Button, { onClick: handlePay, disabled: isPaying, size: "lg", className: "w-full max-w-xs bg-brand hover:bg-brand-hover text-white shadow-[0_4px_16px_rgba(254,44,85,0.25)]", children: isPaying ? '支付中...' : '去支付' })] })] })] }) }));
    }
    // Participant but not winner
    return (_jsx(AnimatePresence, { children: _jsx(Card, { className: "bg-surface-card border-white/10", children: _jsxs(CardContent, { className: "p-6 text-center", children: [_jsx(motion.div, { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: 'spring', stiffness: 150, damping: 15 }, children: _jsx("div", { className: "text-5xl mb-4", children: userOvertaken ? '⚡' : '🔔' }) }), _jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.2 }, children: [_jsx("h2", { className: "text-xl font-bold text-white mb-2", children: "\u7ADE\u62CD\u7ED3\u675F" }), userOvertaken && (_jsx(Badge, { variant: "outline", className: "mb-3 border-brand/30 text-brand", children: "\u51FA\u4EF7\u88AB\u8D85\u8D8A" })), result.winner ? (_jsxs("div", { className: "bg-surface-elevated rounded-xl p-4 mt-3 mb-4", children: [_jsx("p", { className: "text-text-tertiary text-xs mb-2", children: "\u4E2D\u6807\u8005" }), _jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsx(Avatar, { className: "h-8 w-8", children: _jsx(AvatarFallback, { className: "bg-brand/20 text-brand text-sm", children: result.winner.userNickname.charAt(0) }) }), _jsx("span", { className: "text-white font-semibold", children: result.winner.userNickname })] }), _jsx("p", { className: "text-brand text-xl font-bold mt-2", children: formatPrice(result.winner.finalPrice) })] })) : (_jsx("p", { className: "text-text-secondary text-sm", children: "\u65E0\u4EBA\u51FA\u4EF7\uFF0C\u7ADE\u62CD\u6D41\u62CD" })), result.leaderboard && result.leaderboard.length > 0 && (_jsxs("div", { className: "mt-4 border-t border-white/10 pt-4", children: [_jsx("p", { className: "text-text-tertiary text-xs mb-3", children: "\u51FA\u4EF7\u6392\u884C" }), _jsx("div", { className: "space-y-2", children: result.leaderboard.slice(0, 3).map((entry) => (_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                                                                entry.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                                                                    'bg-amber-700/20 text-amber-600'}`, children: entry.rank }), _jsxs("span", { className: entry.isCurrentUser ? 'text-brand font-medium' : 'text-text-secondary', children: [entry.userNickname, entry.isCurrentUser && ' (你)'] })] }), _jsx("span", { className: "text-white font-medium", children: formatPrice(entry.amount) })] }, entry.userId))) })] })), onDismiss && (_jsx(Button, { onClick: onDismiss, variant: "outline", className: "mt-6 border-white/10 text-text-secondary hover:text-white hover:border-white/20", children: "\u5173\u95ED" }))] })] }) }) }));
}
