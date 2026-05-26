import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Segmented, Button, App } from 'antd';
import api from '../../services/api';
import { formatPrice, formatTime } from '../../lib/format';
const FILTER_OPTIONS = [
    { value: 'all', label: '全部' },
    { value: 'pending_payment', label: '待支付' },
    { value: 'paid', label: '已支付' },
    { value: 'cancelled', label: '已取消' },
];
const STATUS_MAP = {
    pending_payment: { color: 'processing', label: '待支付' },
    paid: { color: 'success', label: '已支付' },
    cancelled: { color: 'default', label: '已取消' },
};
export default function OrderList() {
    const { message } = App.useApp();
    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit };
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }
            const response = await api.get('/orders', params);
            const data = response.data;
            setOrders(data?.items || []);
            setTotal(data?.total || 0);
        }
        catch {
            setOrders([]);
            setTotal(0);
        }
        finally {
            setLoading(false);
        }
    }, [page, limit, statusFilter]);
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);
    const handlePay = async (orderId) => {
        try {
            await api.post(`/orders/${orderId}/pay`);
            message.success('支付成功');
            fetchOrders();
        }
        catch (err) {
            message.error(err?.data?.message || '支付失败');
        }
    };
    const columns = [
        {
            title: '订单号',
            dataIndex: 'id',
            key: 'id',
            width: 80,
            render: (id) => `#${id}`,
        },
        {
            title: '商品',
            dataIndex: 'product_id',
            key: 'product_id',
            width: 100,
            render: (id) => `商品 #${id}`,
        },
        {
            title: '买家',
            dataIndex: 'buyer_id',
            key: 'buyer_id',
            width: 100,
            render: (id) => `用户 #${id}`,
        },
        {
            title: '成交价',
            dataIndex: 'final_price',
            key: 'final_price',
            width: 120,
            render: (price) => (_jsx("span", { style: { color: '#1677ff', fontWeight: 600 }, children: formatPrice(price) })),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => {
                const item = STATUS_MAP[status] ?? { color: 'default', label: status };
                return _jsx(Tag, { color: item.color, children: item.label });
            },
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 160,
            render: (time) => formatTime(time),
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_, record) => record.status === 'pending_payment' ? (_jsx(Button, { type: "link", size: "small", onClick: () => handlePay(record.id), children: "\u6A21\u62DF\u652F\u4ED8" })) : null,
        },
    ];
    return (_jsxs("div", { children: [_jsx("div", { style: { marginBottom: 16 }, children: _jsx(Segmented, { options: FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label })), value: statusFilter, onChange: (v) => {
                        setStatusFilter(v);
                        setPage(1);
                    } }) }), _jsx(Table, { dataSource: orders, columns: columns, rowKey: "id", loading: loading, pagination: {
                    current: page,
                    pageSize: limit,
                    total,
                    showSizeChanger: false,
                    showTotal: (t) => `共 ${t} 个订单`,
                    onChange: (p) => setPage(p),
                } })] }));
}
