import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { motion } from 'framer-motion';
import { formatMs } from '../../lib/format';
export default function Countdown({ isUrgent, remainingMs }) {
    const display = remainingMs > 0 ? formatMs(remainingMs) : '竞拍结束';
    const [minutes, rest] = display.split(':');
    const [seconds, millis] = (rest || '00.000').split('.');
    return (_jsxs("div", { className: "text-center", children: [_jsxs(motion.div, { animate: isUrgent ? { scale: [1, 1.05, 1] } : {}, transition: isUrgent ? { repeat: Infinity, duration: 0.5 } : {}, className: `font-mono text-4xl font-bold tracking-wider ${isUrgent ? 'text-brand shadow-glow-brand' : 'text-text-primary'}`, children: [_jsxs("span", { children: [minutes, ":", seconds] }), _jsxs("span", { className: "text-xl", children: [".", millis] })] }), isUrgent && (_jsx(motion.p, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "text-brand text-xs mt-1", children: "\u26A1 \u5373\u5C06\u7ED3\u675F" }))] }));
}
