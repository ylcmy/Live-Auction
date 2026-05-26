import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, Select, Button, Descriptions, Tag, App, Spin } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import api from '../../services/api';
const STATUS_MAP = {
    pending: { color: 'processing', label: '等待中' },
    active: { color: 'success', label: '进行中' },
    ended: { color: 'default', label: '已结束' },
    cancelled: { color: 'error', label: '已取消' },
};
export default function AuctionManage() {
    const { message } = App.useApp();
    const [rooms, setRooms] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentAuction, setCurrentAuction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    useEffect(() => {
        async function init() {
            try {
                const [roomsRes, productsRes] = await Promise.all([
                    api.get('/rooms'),
                    api.get('/products', { status: 'pending' }),
                ]);
                setRooms(roomsRes?.data?.items ?? []);
                setProducts(productsRes?.data?.items ?? []);
            }
            catch {
                // ignore
            }
            finally {
                setPageLoading(false);
            }
        }
        init();
    }, []);
    const startAuction = async () => {
        if (!selectedRoom || !selectedProduct)
            return;
        setLoading(true);
        try {
            const response = await api.post('/auctions', {
                productId: selectedProduct,
                roomId: selectedRoom,
            });
            setCurrentAuction(response.data);
            message.success('竞拍已成功发起！');
        }
        catch (err) {
            message.error(err?.data?.message || '发起竞拍失败');
        }
        setLoading(false);
    };
    if (pageLoading) {
        return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }, children: _jsx(Spin, { size: "large" }) }));
    }
    return (_jsxs("div", { style: { maxWidth: 640 }, children: [_jsxs(Card, { title: "\u53D1\u8D77\u7ADE\u62CD", style: { marginBottom: 24 }, children: [_jsxs("div", { style: { marginBottom: 20 }, children: [_jsx("label", { style: { display: 'block', marginBottom: 8, fontWeight: 500 }, children: "\u9009\u62E9\u76F4\u64AD\u95F4" }), _jsx(Select, { placeholder: "\u8BF7\u9009\u62E9\u76F4\u64AD\u95F4", style: { width: '100%' }, value: selectedRoom, onChange: setSelectedRoom, options: rooms.map((r) => ({ value: r.id, label: `${r.title} (${r.status === 'live' ? '直播中' : '离线'})` })) })] }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("label", { style: { display: 'block', marginBottom: 8, fontWeight: 500 }, children: "\u9009\u62E9\u7ADE\u62CD\u5546\u54C1" }), _jsx(Select, { placeholder: "\u8BF7\u9009\u62E9\u5F85\u7ADE\u62CD\u5546\u54C1", style: { width: '100%' }, value: selectedProduct, onChange: setSelectedProduct, options: products.map((p) => ({
                                    value: p.id,
                                    label: `${p.name}`,
                                    disabled: p.status !== 'pending',
                                })) }), _jsx("div", { style: { fontSize: 12, color: '#8c8c8c', marginTop: 4 }, children: "\u4EC5\u663E\u793A\u72B6\u6001\u4E3A\"\u5F85\u4E0A\u67B6\"\u7684\u5546\u54C1" })] }), _jsx(Button, { type: "primary", size: "large", icon: _jsx(PlayCircleOutlined, {}), loading: loading, disabled: !selectedRoom || !selectedProduct, block: true, onClick: startAuction, children: "\u5F00\u59CB\u7ADE\u62CD" })] }), currentAuction && (_jsx(Card, { title: "\u8FDB\u884C\u4E2D\u7684\u7ADE\u62CD", children: _jsxs(Descriptions, { column: 1, size: "small", children: [_jsx(Descriptions.Item, { label: "\u7ADE\u62CD ID", children: currentAuction.sessionId ?? currentAuction.id ?? '-' }), _jsx(Descriptions.Item, { label: "\u72B6\u6001", children: (() => {
                                const s = currentAuction.status ?? 'active';
                                const cfg = STATUS_MAP[s] ?? { color: 'default', label: s };
                                return _jsx(Tag, { color: cfg.color, children: cfg.label });
                            })() })] }) }))] }));
}
