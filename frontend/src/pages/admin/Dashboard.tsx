import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin, Switch, message, Button } from 'antd';
import { ShopOutlined, PlayCircleOutlined, ShoppingCartOutlined, DollarOutlined, VideoCameraOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { Product, Order } from '../../types/api';

interface MyRoom {
  id: number;
  hostId: number;
  title: string;
  status: 'offline' | 'live';
  streamUrl: string | null;
  createdAt: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ totalProducts: 0, activeProducts: 0, totalOrders: 0, revenue: 0 });
  const [myRoom, setMyRoom] = useState<MyRoom | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await api.get<{ data: MyRoom }>('/rooms/my-room');
      const data = (res as any).data ?? res;
      setMyRoom(data as MyRoom);
    } catch {
      setMyRoom(null);
    }
  }, []);

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
    fetchRoom();
  }, [fetchRoom]);

  const handleStatusToggle = async (checked: boolean) => {
    if (!myRoom) return;
    const newStatus = checked ? 'live' : 'offline';
    setStatusLoading(true);
    try {
      await api.put(`/rooms/${myRoom.id}/status`, { status: newStatus });
      setMyRoom({ ...myRoom, status: newStatus });
      message.success(newStatus === 'live' ? '已开播' : '已下播');
    } catch (err: any) {
      message.error(err?.data?.message || err?.message || '状态切换失败');
    } finally {
      setStatusLoading(false);
    }
  };

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

      {/* 直播间状态管理卡片 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card
            title={
              <span>
                <VideoCameraOutlined style={{ marginRight: 8 }} />
                我的直播间
              </span>
            }
            extra={
              myRoom && (
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/live/${myRoom.id}`)}
                >
                  预览
                </Button>
              )
            }
          >
            {myRoom ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{myRoom.title}</div>
                  <div style={{ color: '#999', fontSize: 13 }}>
                    直播间 ID: {myRoom.id}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Tag color={myRoom.status === 'live' ? 'success' : 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
                    {myRoom.status === 'live' ? '🟢 在线' : '⚫ 离线'}
                  </Tag>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: myRoom.status === 'live' ? '#52c41a' : '#999', fontWeight: 500 }}>
                      {myRoom.status === 'live' ? '直播中' : '未开播'}
                    </span>
                    <Switch
                      checked={myRoom.status === 'live'}
                      onChange={handleStatusToggle}
                      loading={statusLoading}
                      checkedChildren="在线"
                      unCheckedChildren="离线"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
                <VideoCameraOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                <p>暂无直播间</p>
              </div>
            )}
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
