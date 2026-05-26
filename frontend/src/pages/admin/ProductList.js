import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Space, Segmented } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../../services/api';
const FILTER_OPTIONS = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待上架' },
    { value: 'active', label: '竞拍中' },
    { value: 'draft', label: '草稿' },
    { value: 'ended', label: '已结束' },
    { value: 'cancelled', label: '已取消' },
];
const STATUS_MAP = {
    draft: { color: 'default', label: '草稿' },
    pending: { color: 'processing', label: '待上架' },
    active: { color: 'success', label: '竞拍中' },
    ended: { color: 'warning', label: '已结束' },
    cancelled: { color: 'error', label: '已取消' },
    unsold: { color: 'default', label: '未售出' },
};
export default function ProductList() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(12);
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit };
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }
            const response = await api.get('/products', params);
            const data = response.data;
            setProducts((data.items || []));
            setTotal(data.total || 0);
        }
        catch {
            setProducts([]);
            setTotal(0);
        }
        finally {
            setLoading(false);
        }
    }, [page, limit, statusFilter]);
    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);
    const columns = [
        {
            title: '商品名称',
            dataIndex: 'name',
            key: 'name',
            render: (name, record) => (_jsxs(Space, { children: [record.imageUrl ? (_jsx("img", { src: record.imageUrl, alt: name, style: { width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }, onError: (e) => {
                            e.target.style.display = 'none';
                        } })) : (_jsx("div", { style: {
                            width: 40,
                            height: 40,
                            borderRadius: 6,
                            background: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#bbb',
                            fontSize: 14,
                        }, children: "\uD83D\uDCE6" })), _jsx("span", { children: name })] })),
        },
        {
            title: '分类',
            dataIndex: 'category',
            key: 'category',
            width: 100,
            render: (v) => v ?? '-',
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
            title: '操作',
            key: 'action',
            width: 80,
            render: (_, record) => (_jsx(Button, { type: "link", size: "small", onClick: () => navigate(`/admin/products/${record.id}`), children: "\u8BE6\u60C5" })),
        },
    ];
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, children: [_jsx(Segmented, { options: FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label })), value: statusFilter, onChange: (v) => {
                            setStatusFilter(v);
                            setPage(1);
                        } }), _jsx(Button, { type: "primary", icon: _jsx(PlusOutlined, {}), onClick: () => navigate('/admin/products/create'), children: "\u521B\u5EFA\u5546\u54C1" })] }), _jsx(Table, { dataSource: products, columns: columns, rowKey: "id", loading: loading, pagination: {
                    current: page,
                    pageSize: limit,
                    total,
                    showSizeChanger: false,
                    showTotal: (t) => `共 ${t} 个商品`,
                    onChange: (p) => setPage(p),
                } })] }));
}
