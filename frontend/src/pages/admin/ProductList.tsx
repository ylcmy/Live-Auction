import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Space, Segmented } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';
import type { Product, PaginatedData } from '../../types/api';

type StatusFilter = 'all' | 'draft' | 'pending' | 'active' | 'ended' | 'cancelled';

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待上架' },
  { value: 'active', label: '竞拍中' },
  { value: 'draft', label: '草稿' },
  { value: 'ended', label: '已结束' },
  { value: 'cancelled', label: '已取消' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  pending: { color: 'processing', label: '待上架' },
  active: { color: 'success', label: '竞拍中' },
  ended: { color: 'warning', label: '已结束' },
  cancelled: { color: 'error', label: '已取消' },
  unsold: { color: 'default', label: '未售出' },
};

interface ProductWithPrice extends Product {
  currentPrice?: number | null;
}

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductWithPrice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { page, limit };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get<{ data: PaginatedData<Product> }>('/products', params) as any;
      const data = response.data as PaginatedData<Product>;
      setProducts((data.items || []) as ProductWithPrice[]);
      setTotal(data.total || 0);
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const columns: ColumnsType<ProductWithPrice> = [
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          {record.imageUrl ? (
            <img
              src={record.imageUrl}
              alt={name}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#bbb',
                fontSize: 14,
              }}
            >
              📦
            </div>
          )}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const item = STATUS_MAP[status] ?? { color: 'default', label: status };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => navigate(`/admin/products/${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Segmented
          options={FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as StatusFilter);
            setPage(1);
          }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/products/create')}>
          创建商品
        </Button>
      </div>

      <Table<ProductWithPrice>
        dataSource={products}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 个商品`,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}
