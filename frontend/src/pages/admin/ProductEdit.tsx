import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { toast } from '../../design-system/hooks/use-toast';
import { PRODUCT_STATUS_STYLES } from '../../lib/statusConfig';
import type { Product } from '../../types/api';

export default function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasCeilingPrice, setHasCeilingPrice] = useState(false);
  const [form, setForm] = useState({
    bidIncrement: 100,
    ceilingPrice: undefined as number | undefined,
    durationSeconds: 300,
    extendSeconds: 60,
    maxExtensions: 3,
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ data: Product }>(`/products/${id}`)
      .then((res: any) => {
        const data = res.data ?? res;
        setProduct(data);
        if (data.rule) {
          setForm({
            bidIncrement: Number(data.rule.bidIncrement),
            ceilingPrice: data.rule.ceilingPrice ? Number(data.rule.ceilingPrice) : undefined,
            durationSeconds: data.rule.durationSeconds,
            extendSeconds: data.rule.extendSeconds,
            maxExtensions: data.rule.maxExtensions,
          });
          setHasCeilingPrice(!!data.rule.ceilingPrice);
        }
      })
      .catch(() => {
        setProduct(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload = {
        bidIncrement: form.bidIncrement,
        ceilingPrice: hasCeilingPrice ? form.ceilingPrice : null,
        durationSeconds: form.durationSeconds,
        extendSeconds: form.extendSeconds,
        maxExtensions: form.maxExtensions,
      };
      await api.put(`/products/${id}/rules`, payload);
      navigate(`/merchant/products/${id}`);
    } catch (err: any) {
      toast({ title: '更新失败', description: err?.data?.message || '请重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <AlertTriangle className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">商品不存在或已被删除</p>
        <button
          onClick={() => navigate('/merchant/products')}
          className="mt-4 px-5 py-2.5 bg-surface-card border border-slate-200 rounded-lg text-text-secondary hover:bg-surface-secondary transition-all"
        >
          返回商品列表
        </button>
      </div>
    );
  }

  const status = PRODUCT_STATUS_STYLES[product.status] ?? PRODUCT_STATUS_STYLES.pending;
  const canEditRules = product.status === 'pending' || product.status === 'listed';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/merchant/products/${id}`)}
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          返回商品详情
        </button>
        {canEditRules && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg font-medium transition-all shadow-glow-brand disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存修改'}
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold text-text-primary">编辑竞拍规则</h1>

      {/* Product Info Summary */}
      <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          <span className="text-text-primary font-semibold">{product.name}</span>
          <span className="text-text-tertiary text-xs font-mono ml-auto">ID: {product.id}</span>
        </div>
      </div>

      {!canEditRules && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            当前商品状态为「{status.label}」，竞拍规则不可修改
          </span>
        </div>
      )}

      {/* Rules Form */}
      <div className={`bg-surface-card border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm ${!canEditRules ? 'opacity-60 pointer-events-none' : ''}`}>
        <h2 className="text-lg font-bold text-text-primary">竞拍规则</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              加价幅度 (¥) <span className="text-brand">*</span>
            </label>
            <input
              type="number"
              value={form.bidIncrement}
              onChange={(e) => setForm((prev) => ({ ...prev, bidIncrement: Number(e.target.value) }))}
              min={1}
              className="w-full bg-surface-secondary border border-slate-200 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">封顶价 (¥)</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setHasCeilingPrice(!hasCeilingPrice);
                  if (hasCeilingPrice) setForm((prev) => ({ ...prev, ceilingPrice: undefined }));
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${hasCeilingPrice ? 'bg-brand' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${hasCeilingPrice ? 'translate-x-5' : ''}`}
                />
              </button>
              {hasCeilingPrice && (
                <input
                  type="number"
                  value={form.ceilingPrice ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ceilingPrice: e.target.value ? Number(e.target.value) : undefined }))
                  }
                  placeholder="封顶价格"
                  min={1}
                  className="flex-1 bg-surface-secondary border border-slate-200 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              竞拍时长 (秒) <span className="text-brand">*</span>
            </label>
            <input
              type="number"
              value={form.durationSeconds}
              onChange={(e) => setForm((prev) => ({ ...prev, durationSeconds: Number(e.target.value) }))}
              min={10}
              max={3600}
              className="w-full bg-surface-secondary border border-slate-200 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">延时秒数</label>
            <input
              type="number"
              value={form.extendSeconds}
              onChange={(e) => setForm((prev) => ({ ...prev, extendSeconds: Number(e.target.value) }))}
              min={5}
              max={300}
              className="w-full bg-surface-secondary border border-slate-200 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">最大延时次数</label>
            <input
              type="number"
              value={form.maxExtensions}
              onChange={(e) => setForm((prev) => ({ ...prev, maxExtensions: Number(e.target.value) }))}
              min={1}
              max={10}
              className="w-full bg-surface-secondary border border-slate-200 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
