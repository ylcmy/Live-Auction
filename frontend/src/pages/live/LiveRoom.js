import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuctionStore } from '../../store/auctionStore';
import AuctionPanel from './AuctionPanel';
import BidButton from '../../components/auction/BidButton';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
export default function LiveRoom() {
    const { roomId } = useParams();
    const id = Number(roomId);
    const { isConnected, isReconnecting, subscribe } = useWebSocket(id);
    const { setAuction, setLeaderboard, setOnlineCount, setParticipantCount, setEmotion, currentAuction, onlineCount, } = useAuctionStore();
    const [videoError, setVideoError] = useState(false);
    const [room, setRoom] = useState(null);
    const [wasReconnected, setWasReconnected] = useState(false);
    const wasDisconnectedRef = useRef(false);
    useEffect(() => {
        if (!id)
            return;
        api.get(`/rooms/${id}`)
            .then((res) => {
            const data = res.data ?? res;
            setRoom(data);
        })
            .catch(() => { });
    }, [id]);
    const streamUrl = room?.streamUrl;
    useEffect(() => {
        if (!isConnected)
            return;
        const unsubs = [
            subscribe('auction:state', (data) => {
                if (data.status === 'active')
                    setAuction(data);
            }),
            subscribe('rank:update', (data) => setLeaderboard(data)),
            subscribe('room:count', (data) => {
                setOnlineCount(data.onlineCount);
                setParticipantCount(data.participantCount);
            }),
            subscribe('emotion:lead', (data) => setEmotion({ ...data, type: 'lead' })),
            subscribe('emotion:overtaken', (data) => setEmotion({ ...data, type: 'overtaken' })),
            subscribe('countdown:extend', (data) => setEmotion({ ...data, type: 'extended' })),
            subscribe('auction:ended', (data) => setEmotion({ ...data, type: 'ended' })),
            subscribe('auction:cancelled', (data) => setEmotion({ ...data, type: 'cancelled' })),
        ];
        return () => unsubs.forEach((fn) => fn());
    }, [isConnected, subscribe, setAuction, setLeaderboard, setOnlineCount, setParticipantCount, setEmotion]);
    useEffect(() => {
        if (isReconnecting)
            wasDisconnectedRef.current = true;
        if (wasDisconnectedRef.current && isConnected && !isReconnecting) {
            setWasReconnected(true);
            wasDisconnectedRef.current = false;
        }
    }, [isConnected, isReconnecting]);
    useEffect(() => {
        if (wasReconnected) {
            const timer = setTimeout(() => setWasReconnected(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [wasReconnected]);
    const showVideo = streamUrl && !videoError;
    const showProductImage = !showVideo && currentAuction?.product?.imageUrl;
    return (_jsxs("div", { className: "min-h-screen bg-black flex flex-col items-center md:flex-row md:items-stretch md:h-screen md:overflow-hidden", children: [_jsx("div", { className: "w-full md:flex-[1.5] md:h-full bg-surface-secondary relative overflow-hidden flex-shrink-0", children: _jsxs("div", { className: "max-md:aspect-[9/16] max-md:max-w-md max-md:mx-auto h-full w-full relative", children: [showVideo ? (_jsx("video", { className: "w-full h-full object-cover", src: streamUrl, autoPlay: true, muted: true, loop: true, playsInline: true, onError: () => setVideoError(true) })) : showProductImage ? (_jsxs("div", { className: "w-full h-full relative", children: [_jsx("img", { src: currentAuction.product.imageUrl, alt: "", className: "w-full h-full object-cover" }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" })] })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center bg-gradient-to-b from-surface-card to-surface-secondary", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83D\uDCFA" }), _jsx("p", { className: "text-text-secondary", children: "\u76F4\u64AD\u6682\u672A\u5F00\u59CB" })] }) })), _jsx("div", { className: "absolute top-3 left-3 z-10", children: _jsx(motion.div, { animate: { opacity: [1, 0.6, 1] }, transition: { repeat: Infinity, duration: 1.5 }, children: _jsx(Badge, { className: "bg-brand hover:bg-brand text-white border-0 text-xs px-2 py-0.5", children: "LIVE" }) }) }), _jsx("div", { className: "absolute top-3 right-3 z-10", children: _jsxs(Badge, { variant: "secondary", className: "bg-black/60 text-white border-0 text-xs", children: ["\uD83D\uDC41 ", onlineCount] }) })] }) }), _jsx("div", { className: "w-full max-md:max-w-md absolute top-0 left-0 right-0 z-30 md:hidden", children: _jsxs(AnimatePresence, { children: [isReconnecting && (_jsxs(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, className: "bg-warning/90 text-black text-center py-2 text-sm font-medium flex items-center justify-center gap-2 overflow-hidden", children: [_jsx("span", { className: "animate-spin", children: "\u27F3" }), " \u7F51\u7EDC\u65AD\u5F00\uFF0C\u6B63\u5728\u91CD\u8FDE..."] }, "reconnecting")), isConnected && !isReconnecting && wasReconnected && (_jsx(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, className: "bg-success/80 text-white text-center py-1 text-xs overflow-hidden", children: "\u5DF2\u91CD\u65B0\u8FDE\u63A5" }, "reconnected"))] }) }), _jsx("div", { className: "w-full md:w-[380px] md:flex-shrink-0 md:h-full md:overflow-y-auto md:border-l md:border-white/10 bg-surface-card max-md:flex-1 max-md:max-w-md max-md:pb-24", children: _jsx(AuctionPanel, {}) }), _jsx("div", { className: "hidden max-md:flex fixed bottom-0 left-0 right-0 z-20 bg-surface-card/95 backdrop-blur-sm border-t border-white/10 p-4 items-center justify-between", children: currentAuction ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("div", { className: "text-text-tertiary text-xs", children: "\u5F53\u524D\u51FA\u4EF7" }), _jsx("div", { className: "text-brand font-bold text-lg", children: formatPrice(currentAuction.currentPrice) })] }), _jsx("div", { className: "w-48", children: _jsx(BidButton, { sessionId: currentAuction.sessionId }) })] })) : (_jsx("div", { className: "text-text-tertiary text-sm w-full text-center", children: "\u7B49\u5F85\u4E3B\u64AD\u53D1\u8D77\u7ADE\u62CD" })) })] }));
}
