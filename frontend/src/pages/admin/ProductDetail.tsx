import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Spin, App, Image } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import api from '../../services/api';
import type { Product } from '../../types/api';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  pending: { color: 'processing', label: '待上架' },
  active: { color: 'success', label: '竞拍中' },
  ended: { color: 'warning', label: '已结束' },
  cancelled: { color: 'error', label: '已取消' },
  unsold: { color: 'default', label: '未售出' },
};

const CATEGORY_MAP: Record<string, string> = {
  digital: '数码产品',
  wine: '酒水',
  luxury: '奢侈品',
  art: '艺术品',
  collectibles: '收藏品',
  other: '其他',
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ data: Product }>(`/products/${id}`)
      .then((res: any) => {
        const data = res.data ?? res;
        setProduct(data);
      })
      .catch((err: any) => {
        message.error(err?.data?.message || '获取商品详情失败');
      })
      .finally(() => setLoading(false));
  }, [id, message]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: '#8c8c8c', marginBottom: 16 }}>商品不存在或已被删除</p>
        <Button onClick={() => navigate('/admin/products')}>返回商品列表</Button>
      </div>
    );
  }

  const statusCfg = STATUS_MAP[product.status] ?? { color: 'default', label: product.status };
  const rule = product.rule;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/products')}
          style={{ padding: 0 }}
        >
          返回商品列表
        </Button>
      </div>

      <Card
        title="商品详情"
        extra={
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/products/${id}/edit`)}
          >
            编辑
          </Button>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="商品ID">{product.id}</Descriptions.Item>
          <Descriptions.Item label="商品名称">{product.name}</Descriptions.Item>
          <Descriptions.Item label="分类">
            {CATEGORY_MAP[product.category ?? ''] ?? product.category ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {product.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="商品图片" span={2}>
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={120}
                height={120}
                style={{ borderRadius: 8, objectFit: 'cover' }}
                fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjYwIiB5PSI2MCIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiNiYmIiPuKciDwvdGV4dD48L3N2Zz4="
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 8,
                  background: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#bbb',
                  fontSize: 32,
                }}
              >
                📦
              </div>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {rule && (
        <Card title="竞拍规则" size="small" style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <Descriptions.Item label="起拍价">¥{Number(rule.startPrice).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="加价幅度">¥{Number(rule.bidIncrement).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="封顶价">
              {rule.ceilingPrice ? `¥${Number(rule.ceilingPrice).toLocaleString()}` : '无封顶'}
            </Descriptions.Item>
            <Descriptions.Item label="竞拍时长">{rule.durationSeconds}秒</Descriptions.Item>
            <Descriptions.Item label="延时秒数">{rule.extendSeconds}秒</Descriptions.Item>
            <Descriptions.Item label="最大延时次数">{rule.maxExtensions}次</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
