import { useState, useCallback, type FormEvent } from 'react';
import RuleConfig, { validateRuleConfig } from './RuleConfig';
import type { RuleConfigValues } from './RuleConfig';

interface ProductFormValues {
  name: string;
  description: string;
  imageUrl: string;
  category: string;
}

interface ProductFormErrors {
  name?: string;
  description?: string;
  imageUrl?: string;
  category?: string;
}

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  onSubmit: (product: ProductFormValues, rule: RuleConfigValues) => Promise<void>;
  isSubmitting?: boolean;
}

function validateProduct(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (!values.name.trim()) {
    errors.name = '商品名称不能为空';
  } else if (values.name.trim().length > 100) {
    errors.name = '商品名称不能超过 100 个字符';
  }

  if (values.description.length > 2000) {
    errors.description = '商品描述不能超过 2000 个字符';
  }

  return errors;
}

export default function ProductForm({ initialValues, onSubmit, isSubmitting }: ProductFormProps) {
  const [product, setProduct] = useState<ProductFormValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    imageUrl: initialValues?.imageUrl ?? '',
    category: initialValues?.category ?? '',
  });
  const [rules, setRules] = useState<RuleConfigValues | null>(null);
  const [errors, setErrors] = useState<ProductFormErrors>({});

  const handleRuleChange = useCallback((values: RuleConfigValues) => {
    setRules(values);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate product fields
    const productErrors = validateProduct(product);
    setErrors(productErrors);

    // Validate rules
    const ruleErrors = rules ? validateRuleConfig(rules) : [{ field: 'general', message: '请填写竞拍规则' }];

    if (Object.keys(productErrors).length > 0 || ruleErrors.length > 0) {
      return;
    }

    if (!rules) return;

    await onSubmit(product, rules);
  };

  const updateField = (field: keyof ProductFormValues, value: string) => {
    setProduct((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field as keyof ProductFormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof ProductFormErrors];
        return next;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Product Info Section */}
      <div className="space-y-5">
        <h3 className="text-base font-semibold text-text-primary">商品信息</h3>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1.5">
            商品名称 <span className="text-brand">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={product.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="请输入商品名称"
            required
            maxLength={100}
            className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1.5">
            商品描述
          </label>
          <textarea
            id="description"
            value={product.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="请输入商品描述（选填）"
            rows={4}
            maxLength={2000}
            className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors resize-none"
          />
          {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
          <p className="text-text-tertiary text-xs mt-1">{product.description.length}/2000</p>
        </div>

        {/* Image URL */}
        <div>
          <label htmlFor="imageUrl" className="block text-sm font-medium text-text-secondary mb-1.5">
            图片 URL
          </label>
          <input
            id="imageUrl"
            type="url"
            value={product.imageUrl}
            onChange={(e) => updateField('imageUrl', e.target.value)}
            placeholder="请输入商品图片链接（选填）"
            className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          />
          {product.imageUrl && (
            <div className="mt-2 w-32 h-20 bg-surface-secondary rounded-md overflow-hidden border border-white/10">
              <img
                src={product.imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-text-secondary mb-1.5">
            分类
          </label>
          <input
            id="category"
            type="text"
            value={product.category}
            onChange={(e) => updateField('category', e.target.value)}
            placeholder="请输入分类（选填，如：电子产品、艺术品）"
            className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Rules Section */}
      <RuleConfig onChange={handleRuleChange} />

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-md border border-white/10 text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '创建中...' : '创建商品'}
        </button>
      </div>
    </form>
  );
}
