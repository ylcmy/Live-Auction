import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Upload,
  DollarSign,
  Clock,
  Tag,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../design-system/hooks/use-toast';

interface FormData {
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  startPrice: string;
  bidIncrement: string;
  ceilingPrice: string;
  hasCeilingPrice: boolean;
  durationSeconds: string;
  extendSeconds: string;
  maxExtensions: string;
}

const initialForm: FormData = {
  name: '',
  category: '',
  description: '',
  imageUrl: '',
  startPrice: '',
  bidIncrement: '',
  ceilingPrice: '',
  hasCeilingPrice: false,
  durationSeconds: '300',
  extendSeconds: '30',
  maxExtensions: '10',
};

export default function ProductCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) newErrors.name = '请输入商品名称';
    if (!form.startPrice || Number(form.startPrice) <= 0) newErrors.startPrice = '起拍价必须大于0';
    if (!form.bidIncrement || Number(form.bidIncrement) <= 0) newErrors.bidIncrement = '加价幅度必须大于0';
    if (form.hasCeilingPrice && (!form.ceilingPrice || Number(form.ceilingPrice) <= 0)) newErrors.ceilingPrice = '封顶价必须大于0';
    if (!form.durationSeconds || Number(form.durationSeconds) <= 0) newErrors.durationSeconds = '竞拍时长必须大于0';
    if (!form.extendSeconds || Number(form.extendSeconds) <= 0) newErrors.extendSeconds = '延时秒数必须大于0';
    if (!form.maxExtensions || Number(form.maxExtensions) <= 0) newErrors.maxExtensions = '最大延时次数必须大于0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        rule: {
          startPrice: Number(form.startPrice),
          bidIncrement: Number(form.bidIncrement),
          ceilingPrice: form.hasCeilingPrice ? Number(form.ceilingPrice) : undefined,
          durationSeconds: Number(form.durationSeconds),
          extendSeconds: Number(form.extendSeconds),
          maxExtensions: Number(form.maxExtensions),
        },
      };
      const response = (await api.post('/products', payload)) as any;
      void response;
      toast({ title: '商品已创建，请上架后开始竞拍', variant: 'success' });
      navigate('/admin/products');
    } catch (err: any) {
      toast({ title: err?.response?.data?.message || '创建失败，请重试', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const inputClass = (field: keyof FormData) =>
    `w-full bg-surface-card border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all ${
      errors[field] ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200'
    }`;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/admin/products')}
        className="inline-flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        返回商品列表
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">添加商品</h1>
          <p className="text-text-tertiary text-sm mt-1">创建新的直播竞拍商品</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg font-medium transition-all shadow-glow-brand hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '保存商品'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Tag className="w-4 h-4 text-brand" />
            </div>
            <h2 className="text-base font-bold text-text-primary">基本信息</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                商品名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="请输入商品名称"
                className={inputClass('name')}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">商品分类</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                placeholder="如：艺术品、收藏品"
                className={inputClass('category')}
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">商品图片</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => updateField('imageUrl', e.target.value)}
                  placeholder="图片URL"
                  className={`${inputClass('imageUrl')} flex-1`}
                />
                <button className="px-4 py-2.5 bg-surface-secondary border border-slate-200 rounded-lg text-text-secondary hover:bg-slate-100 transition-all">
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-text-secondary text-sm font-medium mb-1.5">商品描述</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="请输入商品描述"
                rows={4}
                className={inputClass('description')}
              />
            </div>
          </div>
        </div>

        {/* Auction Rules */}
        <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-brand/10 rounded-lg">
              <DollarSign className="w-4 h-4 text-brand" />
            </div>
            <h2 className="text-base font-bold text-text-primary">竞拍规则</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                起拍价 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">¥</span>
                <input
                  type="number"
                  value={form.startPrice}
                  onChange={(e) => updateField('startPrice', e.target.value)}
                  placeholder="0"
                  className={`${inputClass('startPrice')} pl-8`}
                />
              </div>
              {errors.startPrice && <p className="text-red-500 text-xs mt-1">{errors.startPrice}</p>}
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                加价幅度 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">¥</span>
                <input
                  type="number"
                  value={form.bidIncrement}
                  onChange={(e) => updateField('bidIncrement', e.target.value)}
                  placeholder="0"
                  className={`${inputClass('bidIncrement')} pl-8`}
                />
              </div>
              {errors.bidIncrement && <p className="text-red-500 text-xs mt-1">{errors.bidIncrement}</p>}
            </div>
            <div>
              <label className="flex items-center gap-2 text-text-secondary text-sm font-medium mb-1.5">
                <input
                  type="checkbox"
                  checked={form.hasCeilingPrice}
                  onChange={(e) => {
                    updateField('hasCeilingPrice', String(e.target.checked));
                    if (!e.target.checked) updateField('ceilingPrice', '');
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                设置封顶价
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">¥</span>
                <input
                  type="number"
                  value={form.ceilingPrice}
                  onChange={(e) => updateField('ceilingPrice', e.target.value)}
                  placeholder={form.hasCeilingPrice ? '0' : '不设封顶'}
                  disabled={!form.hasCeilingPrice}
                  className={`${inputClass('ceilingPrice')} pl-8 ${!form.hasCeilingPrice ? 'bg-slate-50 opacity-50' : ''}`}
                />
              </div>
              {errors.ceilingPrice && <p className="text-red-500 text-xs mt-1">{errors.ceilingPrice}</p>}
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                竞拍时长 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="number"
                  value={form.durationSeconds}
                  onChange={(e) => updateField('durationSeconds', e.target.value)}
                  placeholder="300"
                  className={`${inputClass('durationSeconds')} pl-10`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">秒</span>
              </div>
              {errors.durationSeconds && <p className="text-red-500 text-xs mt-1">{errors.durationSeconds}</p>}
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                延时秒数 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="number"
                  value={form.extendSeconds}
                  onChange={(e) => updateField('extendSeconds', e.target.value)}
                  placeholder="30"
                  className={`${inputClass('extendSeconds')} pl-10`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">秒</span>
              </div>
              {errors.extendSeconds && <p className="text-red-500 text-xs mt-1">{errors.extendSeconds}</p>}
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                最大延时次数 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.maxExtensions}
                  onChange={(e) => updateField('maxExtensions', e.target.value)}
                  placeholder="10"
                  className={inputClass('maxExtensions')}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">次</span>
              </div>
              {errors.maxExtensions && <p className="text-red-500 text-xs mt-1">{errors.maxExtensions}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
