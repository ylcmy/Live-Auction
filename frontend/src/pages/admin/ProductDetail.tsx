import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Edit,
  Play,
  Trash2,
  Clock,
  DollarSign,
  Tag,
  FileText,
} from 'lucide-react';
import api from '../../services/api';
import { PRODUCT_STATUS_STYLES } from '../../lib/statusConfig';
import type { Product } from '../../types/api';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    try {
      const response = (await api.get<{ data: Product }>(`/products/${id}`)) as any;
      setProduct(response.data as Product);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      await api.put(`/products/${id}/status`, { status: 'deleted' });
      navigate('/merchant/products');
    } catch {
      // ignore
    } finally {
      setDeleteLoading(false);
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
        <Package className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">商品不存在</p>
        <button
          onClick={() => navigate('/merchant/products')}
          className="mt-4 text-brand text-sm font-medium hover:underline"
        >
          返回商品列表
        </button>
      </div>
    );
  }

  const status = PRODUCT_STATUS_STYLES[product.status] ?? PRODUCT_STATUS_STYLES.pending;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/merchant/products')}
        className="inline-flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        返回商品列表
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.bg} ${status.text}`}>
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">{product.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/merchant/products/${id}/edit`)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-card border border-slate-200 rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-all text-sm font-medium"
          >
            <Edit className="w-4 h-4" />
            编辑
          </button>
          {product.status === 'listed' && (
            <button
              onClick={() => navigate(`/merchant/auction?productId=${id}`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg font-medium transition-all shadow-glow-brand hover:shadow-lg active:scale-[0.98] text-sm"
            >
              <Play className="w-4 h-4" />
              开始竞拍
            </button>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-card border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left - Image */}
        <div className="lg:col-span-2">
          <div className="bg-surface-card border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="aspect-square bg-surface-secondary flex items-center justify-center border-b border-slate-200">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Package className="w-16 h-16 text-text-tertiary opacity-30" />
              )}
            </div>
            <div className="p-4">
              <p className="text-text-tertiary text-xs">商品图片</p>
            </div>
          </div>
        </div>

        {/* Right - Info */}
        <div className="lg:col-span-3 space-y-4">
          {/* Basic Info */}
          <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-brand" />
              <h2 className="text-base font-bold text-text-primary">基本信息</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <p className="text-text-tertiary text-xs">商品名称</p>
                <p className="text-text-primary text-sm font-medium mt-1">{product.name}</p>
              </div>
              <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <p className="text-text-tertiary text-xs">商品分类</p>
                <p className="text-text-primary text-sm font-medium mt-1">{product.category ?? '未分类'}</p>
              </div>
              <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <p className="text-text-tertiary text-xs">商品状态</p>
                <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                  <span className={`w-1 h-1 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>
              <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                <p className="text-text-tertiary text-xs">商品ID</p>
                <p className="text-text-primary text-sm font-medium mt-1 font-mono">{product.id}</p>
              </div>
            </div>
          </div>

          {/* Auction Rules */}
          {product.rule && (
            <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-brand" />
                <h2 className="text-base font-bold text-text-primary">竞拍规则</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                  <p className="text-text-tertiary text-xs">起拍价</p>
                  <p className="text-brand font-bold text-lg mt-1">¥{Number(product.rule.startPrice).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                  <p className="text-text-tertiary text-xs">加价幅度</p>
                  <p className="text-text-primary font-bold text-lg mt-1">¥{Number(product.rule.bidIncrement).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-surface-secondary rounded-lg border border-slate-100">
                  <p className="text-text-tertiary text-xs">封顶价</p>
                  <p className="text-text-primary font-bold text-lg mt-1">
                    {product.rule.ceilingPrice ? `¥${Number(product.rule.ceilingPrice).toLocaleString()}` : '无'}
                  </p>
                </div>
                <div className="col-span-2 p-3 bg-surface-secondary rounded-lg border border-slate-100">
                  <p className="text-text-tertiary text-xs">竞拍时长</p>
                  <p className="text-text-primary font-bold text-lg mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-tertiary" />
                    {product.rule.durationSeconds} 秒
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="bg-surface-card border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-brand" />
                <h2 className="text-base font-bold text-text-primary">商品描述</h2>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-surface-card border border-slate-200 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-text-primary mb-2">确认删除</h3>
            <p className="text-text-secondary text-sm mb-6">
              确定要删除商品 <span className="text-text-primary font-medium">{product.name}</span> 吗？此操作不可撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-surface-secondary hover:bg-slate-100 border border-slate-200 rounded-lg text-text-secondary text-sm font-medium transition-all"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {deleteLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
