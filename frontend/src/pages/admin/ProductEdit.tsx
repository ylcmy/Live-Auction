import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Card,
  Descriptions,
  Tag,
  Space,
  Switch,
  Spin,
  App,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
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

export default function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasCeilingPrice, setHasCeilingPrice] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ data: Product }>(`/products/${id}`)
      .then((res: any) => {
        const data = res.data ?? res;
        setProduct(data);
        if (data.rule) {
          form.setFieldsValue({
            bidIncrement: Number(data.rule.bidIncrement),
            ceilingPrice: data.rule.ceilingPrice ? Number(data.rule.ceilingPrice) : undefined,
            durationSeconds: data.rule.durationSeconds,
            extendSeconds: data.rule.extendSeconds,
            maxExtensions: data.rule.maxExtensions,
          });
          setHasCeilingPrice(!!data.rule.ceilingPrice);
        }
      })
      .catch((err: any) => {
        message.error(err?.data?.message || '获取商品详情失败');
      })
      .finally(() => setLoading(false));
  }, [id, form, message]);

  const handleSave = async (values: Record<string, unknown>) => {
    if (!id) return;
    setSaving(true);
    try {
      const payload = {
        bidIncrement: values.bidIncrement,
        ceilingPrice: hasCeilingPrice ? values.ceilingPrice : null,
        durationSeconds: values.durationSeconds,
        extendSeconds: values.extendSeconds,
        maxExtensions: values.maxExtensions,
      };
      await api.put(`/products/${id}/rules`, payload);
      message.success('竞拍规则更新成功');
      navigate(`/admin/products/${id}`);
    } catch (err: any) {
      message.error(err?.data?.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

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
  const canEditRules = product.status === 'draft' || product.status === 'pending';

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/admin/products/${id}`)}
          style={{ padding: 0 }}
        >
          返回商品详情
        </Button>
      </div>

      <Card title="商品信息" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="商品名称">{product.name}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="分类">{product.category ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="描述">{product.description || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="竞拍规则">
        {!canEditRules && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', borderRadius: 6, fontSize: 13, color: '#ad6800' }}>
            当前商品状态为「{statusCfg.label}」，竞拍规则不可修改
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          disabled={!canEditRules}
        >
          <Space size="large" wrap>
            <Form.Item
              name="bidIncrement"
              label="加价幅度 (¥)"
              rules={[{ required: true, message: '请输入加价幅度' }]}
            >
              <InputNumber min={1} max={99999999} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item label="封顶价">
              <Space>
                <Switch checked={hasCeilingPrice} onChange={setHasCeilingPrice} disabled={!canEditRules} />
                {hasCeilingPrice && (
                  <Form.Item name="ceilingPrice" noStyle>
                    <InputNumber min={1} max={99999999} placeholder="封顶价格" style={{ width: 160 }} />
                  </Form.Item>
                )}
              </Space>
            </Form.Item>
          </Space>

          <Space size="large" wrap>
            <Form.Item
              name="durationSeconds"
              label="竞拍时长 (秒)"
              rules={[{ required: true, message: '请输入竞拍时长' }]}
            >
              <InputNumber min={10} max={3600} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item
              name="extendSeconds"
              label="延时秒数"
              rules={[{ required: true, message: '请输入延时秒数' }]}
            >
              <InputNumber min={5} max={300} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item
              name="maxExtensions"
              label="最大延时次数"
              rules={[{ required: true, message: '请输入最大延时次数' }]}
            >
              <InputNumber min={1} max={10} style={{ width: 160 }} />
            </Form.Item>
          </Space>

          {canEditRules && (
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={saving}>
                  保存修改
                </Button>
                <Button onClick={() => navigate(`/admin/products/${id}`)}>取消</Button>
              </Space>
            </Form.Item>
          )}
        </Form>
      </Card>
    </div>
  );
}
