import type { Product } from '../../types/api';
import { formatPrice } from '../../lib/format';
import { Card } from '../../design-system/components/ui/card';
import { Badge } from '../../design-system/components/ui/badge';

interface ProductCardProps {
  product: Product;
  currentPrice?: number | null;
  onClick?: () => void;
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  draft: { variant: 'outline', label: '草稿' },
  pending: { variant: 'secondary', label: '待上架' },
  active: { variant: 'default', label: '竞拍中' },
  ended: { variant: 'secondary', label: '已结束' },
  cancelled: { variant: 'destructive', label: '已取消' },
  unsold: { variant: 'outline', label: '未售出' },
};

export default function ProductCard({ product, currentPrice, onClick }: ProductCardProps) {
  const statusCfg = STATUS_CONFIG[product.status] || STATUS_CONFIG.draft;

  return (
    <Card
      onClick={onClick}
      className="bg-surface-card border-white/10 overflow-hidden cursor-pointer hover:border-white/20 hover:bg-surface-elevated transition-all duration-200 group"
    >
      <div className="aspect-video bg-surface-secondary relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <Badge
          variant={statusCfg.variant}
          className={`absolute top-2 right-2 text-xs font-medium ${
            product.status === 'active' ? 'bg-brand text-white hover:bg-brand border-0' : ''
          }`}
        >
          {statusCfg.label}
        </Badge>
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-white font-medium text-sm truncate">{product.name}</h3>

        {product.description && (
          <p className="text-text-tertiary text-xs line-clamp-2">{product.description}</p>
        )}

        {product.category && (
          <Badge variant="secondary" className="bg-surface-secondary text-text-tertiary border-0 text-xs">
            {product.category}
          </Badge>
        )}

        {currentPrice !== undefined && currentPrice !== null && product.status === 'active' && (
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-text-tertiary text-xs">当前出价</span>
            <span className="text-brand font-semibold text-sm">{formatPrice(currentPrice)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
