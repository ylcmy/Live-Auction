import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin } from 'antd';
import { ShopOutlined, PlayCircleOutlined, ShoppingCartOutlined, DollarOutlined } from '@ant-design/icons';
import api from '../../services/api';
export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({ totalProducts: 0, activeProducts: 0, totalOrders: 0, revenue: 0 });
    useEffect(() => {
        async function fetchData() {
            try {
                const [productsRes, ordersRes] = await Promise.all([
                    api.get('/products', { page: '1', limit: '100' }),
                    api.get('/orders', { page: '1', limit: '10' }),
                ]);
                const productItems = productsRes?.data?.items ?? [];
                const orderItems = ordersRes?.data?.items ?? [];
                setProducts(productItems);
                setOrders(orderItems);
                setStats({
                    totalProducts: productItems.length,
                    activeProducts: productItems.filter((p) => p.status === 'active').length,
                    totalOrders: orderItems.length,
                    revenue: orderItems
                        .filter((o) => o.status === 'paid')
                        .reduce((sum, o) => sum + o.finalPrice, 0),
                });
            }
            finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);
    const statusMap = {
        draft: { color: 'default', label: '草稿' },
        pending: { color: 'processing', label: '待上架' },
        active: { color: 'success', label: '进行中' },
        ended: { color: 'warning', label: '已结束' },
        cancelled: { color: 'error', label: '已取消' },
        unsold: { color: 'default', label: '未售出' },
    };
    const orderColumns = [
        { title: '订单号', dataIndex: 'id', key: 'id', width: 80 },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => {
                const map = {
                    pending_payment: { color: 'processing', label: '待付款' },
                    paid: { color: 'success', label: '已付款' },
                    cancelled: { color: 'default', label: '已取消' },
                };
                const item = map[status] ?? { color: 'default', label: status };
                return _jsx(Tag, { color: item.color, children: item.label });
            },
        },
        {
            title: '成交价',
            dataIndex: 'finalPrice',
            key: 'finalPrice',
            width: 120,
            render: (price) => `¥${price.toLocaleString()}`,
        },
    ];
    if (loading) {
        return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }, children: _jsx(Spin, { size: "large" }) }));
    }
    return (_jsxs("div", { children: [_jsxs(Row, { gutter: [16, 16], children: [_jsx(Col, { xs: 12, sm: 12, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u5546\u54C1\u603B\u6570", value: stats.totalProducts, prefix: _jsx(ShopOutlined, {}), valueStyle: { color: '#1677ff' } }) }) }), _jsx(Col, { xs: 12, sm: 12, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u8FDB\u884C\u4E2D", value: stats.activeProducts, prefix: _jsx(PlayCircleOutlined, {}), valueStyle: { color: '#52c41a' } }) }) }), _jsx(Col, { xs: 12, sm: 12, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u4ECA\u65E5\u8BA2\u5355", value: stats.totalOrders, prefix: _jsx(ShoppingCartOutlined, {}), valueStyle: { color: '#fa8c16' } }) }) }), _jsx(Col, { xs: 12, sm: 12, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u6210\u4EA4\u989D", value: stats.revenue, prefix: _jsx(DollarOutlined, {}), precision: 0, valueStyle: { color: '#722ed1' } }) }) })] }), _jsxs(Row, { gutter: [16, 16], style: { marginTop: 24 }, children: [_jsx(Col, { xs: 24, md: 14, children: _jsx(Card, { title: "\u5546\u54C1\u6982\u89C8", children: _jsx(Table, { dataSource: products.slice(0, 5), rowKey: "id", size: "small", pagination: false, columns: [
                                    { title: '商品名称', dataIndex: 'name', key: 'name' },
                                    {
                                        title: '状态',
                                        dataIndex: 'status',
                                        key: 'status',
                                        render: (status) => {
                                            const item = statusMap[status] ?? { color: 'default', label: status };
                                            return _jsx(Tag, { color: item.color, children: item.label });
                                        },
                                    },
                                    {
                                        title: '分类',
                                        dataIndex: 'category',
                                        key: 'category',
                                        render: (v) => v ?? '-',
                                    },
                                ] }) }) }), _jsx(Col, { xs: 24, md: 10, children: _jsx(Card, { title: "\u6700\u8FD1\u8BA2\u5355", children: _jsx(Table, { dataSource: orders.slice(0, 5), rowKey: "id", size: "small", pagination: false, columns: orderColumns }) }) })] })] }));
}
