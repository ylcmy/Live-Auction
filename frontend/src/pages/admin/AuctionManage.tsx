import { useState, useEffect } from 'react';
import { Card, Select, Button, Descriptions, Tag, App, Spin } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import api from '../../services/api';
import type { LiveRoom, Product } from '../../types/api';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '等待中' },
  active: { color: 'success', label: '进行中' },
  ended: { color: 'default', label: '已结束' },
  cancelled: { color: 'error', label: '已取消' },
};

export default function AuctionManage() {
  const { message } = App.useApp();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [currentAuction, setCurrentAuction] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const [roomsRes, productsRes] = await Promise.all([
          api.get<{ data: { items: LiveRoom[] } }>('/rooms'),
          api.get<{ data: { items: Product[] } }>('/products', { status: 'pending' }),
        ]);
        setRooms((roomsRes as any)?.data?.items ?? []);
        setProducts((productsRes as any)?.data?.items ?? []);
      } catch {
        // ignore
      } finally {
        setPageLoading(false);
      }
    }
    init();
  }, []);

  const startAuction = async () => {
    if (!selectedRoom || !selectedProduct) return;
    setLoading(true);
    try {
      const response = await api.post<{ data: Record<string, unknown> }>('/auctions', {
        productId: selectedProduct,
        roomId: selectedRoom,
      });
      setCurrentAuction((response as any).data);
      message.success('竞拍已成功发起！');
    } catch (err: any) {
      message.error(err?.data?.message || '发起竞拍失败');
    }
    setLoading(false);
  };

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Card title="发起竞拍" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>选择直播间</label>
          <Select
            placeholder="请选择直播间"
            style={{ width: '100%' }}
            value={selectedRoom}
            onChange={setSelectedRoom}
            options={rooms.map((r) => ({ value: r.id, label: `${r.title} (${r.status === 'live' ? '直播中' : '离线'})` }))}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>选择竞拍商品</label>
          <Select
            placeholder="请选择待竞拍商品"
            style={{ width: '100%' }}
            value={selectedProduct}
            onChange={setSelectedProduct}
            options={products.map((p) => ({
              value: p.id,
              label: `${p.name}`,
              disabled: p.status !== 'pending',
            }))}
          />
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
            仅显示状态为"待上架"的商品
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          loading={loading}
          disabled={!selectedRoom || !selectedProduct}
          block
          onClick={startAuction}
        >
          开始竞拍
        </Button>
      </Card>

      {currentAuction && (
        <Card title="进行中的竞拍">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="竞拍 ID">
              {(currentAuction as any).sessionId ?? (currentAuction as any).id ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => {
                const s = (currentAuction as any).status ?? 'active';
                const cfg = STATUS_MAP[s] ?? { color: 'default', label: s };
                return <Tag color={cfg.color}>{cfg.label}</Tag>;
              })()}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
