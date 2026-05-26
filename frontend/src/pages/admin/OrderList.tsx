import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Segmented, Button, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';
import { formatPrice, formatTime } from '../../lib/format';
import type { OrderStatus } from '../../types/api';

type StatusFilter = 'all' | 'pending_payment' | 'paid' | 'cancelled';

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending_payment', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'cancelled', label: '已取消' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending_payment: { color: 'processing', label: '待支付' },
  paid: { color: 'success', label: '已支付' },
  cancelled: { color: 'default', label: '已取消' },
};

interface OrderItem {
  id: number;
  session_id: number;
  buyer_id: number;
  product_id: number;
  final_price: number;
  status: OrderStatus;
  created_at: string;
}

export default function OrderList() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { page, limit };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get<{ data: { items: OrderItem[]; total: number } }>('/orders', params) as any;
      const data = response.data;
      setOrders(data?.items || []);
      setTotal(data?.total || 0);
    } catch {
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handlePay = async (orderId: number) => {
    try {
      await api.post(`/orders/${orderId}/pay`);
      message.success('支付成功');
      fetchOrders();
    } catch (err: any) {
      message.error(err?.data?.message || '支付失败');
    }
  };

  const columns: ColumnsType<OrderItem> = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: number) => `#${id}`,
    },
    {
      title: '商品',
      dataIndex: 'product_id',
      key: 'product_id',
      width: 100,
      render: (id: number) => `商品 #${id}`,
    },
    {
      title: '买家',
      dataIndex: 'buyer_id',
      key: 'buyer_id',
      width: 100,
      render: (id: number) => `用户 #${id}`,
    },
    {
      title: '成交价',
      dataIndex: 'final_price',
      key: 'final_price',
      width: 120,
      render: (price: number) => (
        <span style={{ color: '#1677ff', fontWeight: 600 }}>{formatPrice(price)}</span>
      ),
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => formatTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) =>
        record.status === 'pending_payment' ? (
          <Button type="link" size="small" onClick={() => handlePay(record.id)}>
            模拟支付
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as StatusFilter);
            setPage(1);
          }}
        />
      </div>

      <Table<OrderItem>
        dataSource={orders}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 个订单`,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}
