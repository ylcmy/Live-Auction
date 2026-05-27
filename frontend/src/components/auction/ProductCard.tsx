import { motion } from 'framer-motion';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import { formatPrice, getPriceLabel } from '../../lib/format';
import type { RoomAuctionItem, AuctionStatus } from '../../types/api';

const STATUS_CONFIG: Record<AuctionStatus, { label: string; className: string }> = {
  pending: { label: '待拍', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  active: { label: '竞拍中', className: 'bg-brand/20 text-brand border-brand/30' },
  ended: { label: '已成交', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  unsold: { label: '流拍', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  cancelled: { label: '已取消', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

interface ProductCardProps {
  item: RoomAuctionItem;
  isCurrent: boolean;
  myLastBid: number | null;
  onSelect: () => void;
  onBid: () => void;
}

export default function ProductCard({ item, isCurrent, myLastBid, onSelect, onBid }: ProductCardProps) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const { label: priceLabel, price: displayPrice } = getPriceLabel(item);
  const isActive = item.status === 'active';
  const isClickable = ['pending', 'active'].includes(item.status);

  return (
    <motion.div
      whileTap={isClickable ? { scale: 0.98 } : undefined}
      onClick={isClickable ? onSelect : undefined}
      className={`rounded-lg p-3 transition-colors ${
        isCurrent
          ? 'bg-brand/10 border border-brand/30'
          : isClickable
            ? 'bg-surface-elevated border border-white/5 hover:border-brand/30 hover:bg-brand/5 cursor-pointer'
            : 'bg-surface-elevated border border-white/5 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        {item.product?.imageUrl ? (
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="w-12 h-12 rounded-md object-cover bg-surface-secondary flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-surface-secondary flex items-center justify-center text-lg flex-shrink-0">
            📦
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium truncate">
              {item.product?.name ?? `商品 #${item.sessionId}`}
            </span>
            <Badge className={`${cfg.className} text-[10px] border px-1.5 py-0`}>
              {cfg.label}
            </Badge>
            {isCurrent && (
              <Badge className="bg-brand text-white border-0 text-[10px] px-1.5 py-0 animate-pulse">
                LIVE
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <div className="flex flex-col">
              <span className="text-text-tertiary text-[10px]">{priceLabel}</span>
              <span className={`font-semibold text-sm ${isActive || item.status === 'ended' ? 'text-brand' : 'text-text-secondary'}`}>
                {formatPrice(displayPrice)}
              </span>
            </div>

            {myLastBid != null && (
              <div className="text-right">
                <span className="text-text-tertiary text-[10px]">我的出价</span>
                <span className="block text-accent text-xs font-medium">{formatPrice(myLastBid)}</span>
              </div>
            )}

            {isActive && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onBid();
                }}
                size="sm"
                className="h-7 px-3 rounded-full bg-brand hover:bg-brand-hover text-white text-xs font-semibold border-0"
              >
                出价
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
