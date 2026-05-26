import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Space,
  Switch,
  App,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { TextArea } = Input;

const CATEGORY_OPTIONS = [
  { value: 'digital', label: '数码产品' },
  { value: 'wine', label: '酒水' },
  { value: 'luxury', label: '奢侈品' },
  { value: 'art', label: '艺术品' },
  { value: 'collectibles', label: '收藏品' },
  { value: 'other', label: '其他' },
];

export default function ProductCreate() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [hasCeilingPrice, setHasCeilingPrice] = useState(false);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const payload = {
        name: (values.name as string).trim(),
        description: (values.description as string)?.trim() || null,
        imageUrl: (values.imageUrl as string)?.trim() || null,
        category: values.category as string,
        rule: {
          startPrice: values.startPrice,
          bidIncrement: values.bidIncrement,
          ceilingPrice: hasCeilingPrice ? values.ceilingPrice : null,
          durationSeconds: values.durationSeconds,
          extendSeconds: values.extendSeconds,
          maxExtensions: values.maxExtensions,
        },
      };

      await api.post('/products', payload);
      message.success('创建成功！即将跳转到商品列表...');
      setTimeout(() => {
        navigate('/admin/products');
      }, 1500);
    } catch (err: any) {
      message.error(err?.data?.message || err.message || '创建商品失败，请重试');
    } finally {
      setLoading(false);
    }
  };

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

      <Card title="创建竞拍商品">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            category: 'digital',
            startPrice: 100,
            bidIncrement: 100,
            durationSeconds: 300,
            extendSeconds: 60,
            maxExtensions: 3,
          }}
        >
          <Form.Item
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="请输入商品名称" maxLength={100} />
          </Form.Item>

          <Form.Item name="description" label="商品描述">
            <TextArea rows={3} placeholder="请输入商品描述（选填）" maxLength={500} />
          </Form.Item>

          <Form.Item name="imageUrl" label="商品图片 URL">
            <Input placeholder="请输入图片链接（选填）" />
          </Form.Item>

          <Form.Item name="category" label="商品分类" rules={[{ required: true, message: '请选择商品分类' }]}>
            <Select options={CATEGORY_OPTIONS} placeholder="请选择分类" />
          </Form.Item>

          <Card title="竞拍规则" size="small" style={{ marginBottom: 24 }}>
            <Space size="large" wrap>
              <Form.Item
                name="startPrice"
                label="起拍价 (¥)"
                rules={[{ required: true, message: '请输入起拍价' }]}
              >
                <InputNumber min={1} max={99999999} style={{ width: 160 }} />
              </Form.Item>

              <Form.Item
                name="bidIncrement"
                label="加价幅度 (¥)"
                rules={[{ required: true, message: '请输入加价幅度' }]}
              >
                <InputNumber min={1} max={99999999} style={{ width: 160 }} />
              </Form.Item>

              <Form.Item label="封顶价">
                <Space>
                  <Switch checked={hasCeilingPrice} onChange={setHasCeilingPrice} />
                  {hasCeilingPrice && (
                    <Form.Item name="ceilingPrice" noStyle>
                      <InputNumber
                        min={1}
                        max={99999999}
                        placeholder="封顶价格"
                        style={{ width: 160 }}
                      />
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
          </Card>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建商品
              </Button>
              <Button onClick={() => navigate('/admin/products')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
