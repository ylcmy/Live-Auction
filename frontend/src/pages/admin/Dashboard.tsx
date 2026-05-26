import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin } from 'antd';
import { ShopOutlined, PlayCircleOutlined, ShoppingCartOutlined, DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';
import type { Product, Order } from '../../types/api';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ totalProducts: 0, activeProducts: 0, totalOrders: 0, revenue: 0 });

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, ordersRes] = await Promise.all([
          api.get<{ data: { items: Product[]; total: number } }>('/products', { page: '1', limit: '100' }),
          api.get<{ data: { items: Order[]; total: number } }>('/orders', { page: '1', limit: '10' }),
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
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const statusMap: Record<string, { color: string; label: string }> = {
    draft: { color: 'default', label: '草稿' },
    pending: { color: 'processing', label: '待上架' },
    active: { color: 'success', label: '进行中' },
    ended: { color: 'warning', label: '已结束' },
    cancelled: { color: 'error', label: '已取消' },
    unsold: { color: 'default', label: '未售出' },
  };

  const orderColumns: ColumnsType<Order> = [
    { title: '订单号', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const map: Record<string, { color: string; label: string }> = {
          pending_payment: { color: 'processing', label: '待付款' },
          paid: { color: 'success', label: '已付款' },
          cancelled: { color: 'default', label: '已取消' },
        };
        const item = map[status] ?? { color: 'default', label: status };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '成交价',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      width: 120,
      render: (price: number) => `¥${price.toLocaleString()}`,
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="商品总数"
              value={stats.totalProducts}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats.activeProducts}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日订单"
              value={stats.totalOrders}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="成交额"
              value={stats.revenue}
              prefix={<DollarOutlined />}
              precision={0}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={14}>
          <Card title="商品概览">
            <Table<Product>
              dataSource={products.slice(0, 5)}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: '商品名称', dataIndex: 'name', key: 'name' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status: string) => {
                    const item = statusMap[status] ?? { color: 'default', label: status };
                    return <Tag color={item.color}>{item.label}</Tag>;
                  },
                },
                {
                  title: '分类',
                  dataIndex: 'category',
                  key: 'category',
                  render: (v: string | null) => v ?? '-',
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="最近订单">
            <Table<Order>
              dataSource={orders.slice(0, 5)}
              rowKey="id"
              size="small"
              pagination={false}
              columns={orderColumns}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
