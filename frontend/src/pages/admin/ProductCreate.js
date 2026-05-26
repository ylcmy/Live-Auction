import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, InputNumber, Select, Button, Card, Space, Switch, App, } from 'antd';
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
    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const payload = {
                name: values.name.trim(),
                description: values.description?.trim() || null,
                imageUrl: values.imageUrl?.trim() || null,
                category: values.category,
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
        }
        catch (err) {
            message.error(err?.data?.message || err.message || '创建商品失败，请重试');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { style: { maxWidth: 720 }, children: [_jsx("div", { style: { marginBottom: 24 }, children: _jsx(Button, { type: "text", icon: _jsx(ArrowLeftOutlined, {}), onClick: () => navigate('/admin/products'), style: { padding: 0 }, children: "\u8FD4\u56DE\u5546\u54C1\u5217\u8868" }) }), _jsx(Card, { title: "\u521B\u5EFA\u7ADE\u62CD\u5546\u54C1", children: _jsxs(Form, { form: form, layout: "vertical", onFinish: handleSubmit, initialValues: {
                        category: 'digital',
                        startPrice: 100,
                        bidIncrement: 100,
                        durationSeconds: 300,
                        extendSeconds: 60,
                        maxExtensions: 3,
                    }, children: [_jsx(Form.Item, { name: "name", label: "\u5546\u54C1\u540D\u79F0", rules: [{ required: true, message: '请输入商品名称' }], children: _jsx(Input, { placeholder: "\u8BF7\u8F93\u5165\u5546\u54C1\u540D\u79F0", maxLength: 100 }) }), _jsx(Form.Item, { name: "description", label: "\u5546\u54C1\u63CF\u8FF0", children: _jsx(TextArea, { rows: 3, placeholder: "\u8BF7\u8F93\u5165\u5546\u54C1\u63CF\u8FF0\uFF08\u9009\u586B\uFF09", maxLength: 500 }) }), _jsx(Form.Item, { name: "imageUrl", label: "\u5546\u54C1\u56FE\u7247 URL", children: _jsx(Input, { placeholder: "\u8BF7\u8F93\u5165\u56FE\u7247\u94FE\u63A5\uFF08\u9009\u586B\uFF09" }) }), _jsx(Form.Item, { name: "category", label: "\u5546\u54C1\u5206\u7C7B", rules: [{ required: true, message: '请选择商品分类' }], children: _jsx(Select, { options: CATEGORY_OPTIONS, placeholder: "\u8BF7\u9009\u62E9\u5206\u7C7B" }) }), _jsxs(Card, { title: "\u7ADE\u62CD\u89C4\u5219", size: "small", style: { marginBottom: 24 }, children: [_jsxs(Space, { size: "large", wrap: true, children: [_jsx(Form.Item, { name: "startPrice", label: "\u8D77\u62CD\u4EF7 (\u00A5)", rules: [{ required: true, message: '请输入起拍价' }], children: _jsx(InputNumber, { min: 1, max: 99999999, style: { width: 160 } }) }), _jsx(Form.Item, { name: "bidIncrement", label: "\u52A0\u4EF7\u5E45\u5EA6 (\u00A5)", rules: [{ required: true, message: '请输入加价幅度' }], children: _jsx(InputNumber, { min: 1, max: 99999999, style: { width: 160 } }) }), _jsx(Form.Item, { label: "\u5C01\u9876\u4EF7", children: _jsxs(Space, { children: [_jsx(Switch, { checked: hasCeilingPrice, onChange: setHasCeilingPrice }), hasCeilingPrice && (_jsx(Form.Item, { name: "ceilingPrice", noStyle: true, children: _jsx(InputNumber, { min: 1, max: 99999999, placeholder: "\u5C01\u9876\u4EF7\u683C", style: { width: 160 } }) }))] }) })] }), _jsxs(Space, { size: "large", wrap: true, children: [_jsx(Form.Item, { name: "durationSeconds", label: "\u7ADE\u62CD\u65F6\u957F (\u79D2)", rules: [{ required: true, message: '请输入竞拍时长' }], children: _jsx(InputNumber, { min: 10, max: 3600, style: { width: 160 } }) }), _jsx(Form.Item, { name: "extendSeconds", label: "\u5EF6\u65F6\u79D2\u6570", rules: [{ required: true, message: '请输入延时秒数' }], children: _jsx(InputNumber, { min: 5, max: 300, style: { width: 160 } }) }), _jsx(Form.Item, { name: "maxExtensions", label: "\u6700\u5927\u5EF6\u65F6\u6B21\u6570", rules: [{ required: true, message: '请输入最大延时次数' }], children: _jsx(InputNumber, { min: 1, max: 10, style: { width: 160 } }) })] })] }), _jsx(Form.Item, { children: _jsxs(Space, { children: [_jsx(Button, { type: "primary", htmlType: "submit", loading: loading, children: "\u521B\u5EFA\u5546\u54C1" }), _jsx(Button, { onClick: () => navigate('/admin/products'), children: "\u53D6\u6D88" })] }) })] }) })] }));
}
