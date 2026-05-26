import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useBid } from '../../hooks/useBid';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { Button } from '../../design-system/components/ui/button';
export default function BidButton({ sessionId }) {
    const { submitBid } = useBid(sessionId);
    const currentAuction = useAuctionStore((s) => s.currentAuction);
    const [isPressed, setIsPressed] = useState(false);
    if (!currentAuction)
        return null;
    const nextBid = currentAuction.currentPrice + currentAuction.rule.bidIncrement;
    const overCeiling = currentAuction.rule.ceilingPrice && nextBid > currentAuction.rule.ceilingPrice;
    const disabled = overCeiling || currentAuction.status !== 'active';
    const handleClick = () => {
        if (disabled)
            return;
        setIsPressed(true);
        submitBid();
        setTimeout(() => setIsPressed(false), 300);
    };
    return (_jsx(motion.div, { whileTap: { scale: 0.96 }, animate: isPressed ? { scale: [1, 0.95, 1.05, 1] } : {}, transition: { duration: 0.3 }, children: _jsx(Button, { onClick: handleClick, disabled: disabled, size: "lg", className: "relative w-full h-auto py-4 rounded-full bg-gradient-to-r from-brand to-brand-hover hover:from-brand-hover hover:to-brand text-white font-bold text-lg shadow-[0_4px_20px_rgba(254,44,85,0.35)] hover:shadow-[0_6px_28px_rgba(254,44,85,0.5)] disabled:opacity-40 disabled:cursor-not-allowed border-0", children: _jsxs("div", { className: "flex flex-col items-center gap-0.5", children: [_jsxs("span", { className: "text-xs opacity-80", children: ["\u52A0\u4EF7\u5E45\u5EA6 ", formatPrice(currentAuction.rule.bidIncrement)] }), _jsxs("span", { className: "text-xl", children: ["\uD83D\uDD25 \u51FA\u4EF7 ", formatPrice(nextBid)] })] }) }) }));
}
