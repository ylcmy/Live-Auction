import { formatPrice, getPriceLabel } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
import { Separator } from '../../design-system/components/ui/separator';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { AUCTION_STATUS_CONFIG } from '../../lib/statusConfig';
import type { RoomAuctionItem } from '../../types/api';

interface ProductListProps {
  auctions: RoomAuctionItem[];
  currentSessionId?: number;
  onSelectAuction?: (item: RoomAuctionItem) => void;
}

export default function ProductList({ auctions, currentSessionId, onSelectAuction }: ProductListProps) {
  if (!auctions.length) {
    return (
      <div className="px-4 py-6 text-center">
        <div className="text-3xl mb-2">📦</div>
        <p className="text-text-tertiary text-sm">暂无竞拍商品</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-text-secondary text-xs font-medium">竞拍商品</span>
          <Badge variant="secondary" className="bg-surface-secondary text-text-tertiary border-0 text-[10px]">
            共 {auctions.length} 件
          </Badge>
        </div>

        {auctions.map((item, idx) => {
          const cfg = AUCTION_STATUS_CONFIG[item.status] ?? AUCTION_STATUS_CONFIG.listed;
          const isCurrent = item.sessionId === currentSessionId;
          const isClickable = ['listed', 'active'].includes(item.status) && onSelectAuction;
          const priceInfo = getPriceLabel(item);

          return (
            <div key={item.sessionId}>
              <motion.div
                whileTap={isClickable ? { scale: 0.98 } : undefined}
                onClick={isClickable ? () => onSelectAuction(item) : undefined}
                className={`rounded-xl p-3 transition-all duration-300 ${
                  isCurrent
                    ? 'bg-brand-50 border border-brand/30 shadow-sm'
                    : isClickable
                      ? 'bg-surface-secondary border border-surface-border hover:border-brand/30 hover:bg-brand-50/50 cursor-pointer'
                      : 'bg-surface-secondary border border-surface-border opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Product Image */}
                  <div className="relative flex-shrink-0">
                    {item.product?.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-14 h-14 rounded-lg object-cover bg-surface-secondary"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-surface-secondary flex items-center justify-center text-lg">
                        📦
                      </div>
                    )}
                    {/* Status badge on image */}
                    <div className="absolute -top-1 -left-1">
                      <Badge className={`${cfg.className} text-[10px] border px-1 py-0`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Product name */}
                    <h3 className="text-text-primary text-sm font-medium truncate leading-tight">
                      {item.product?.name ?? `商品 #${item.sessionId}`}
                    </h3>

                    {/* Price info */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-text-tertiary text-[11px]">{priceInfo.label}</span>
                      <span className={`font-bold text-sm ${
                        item.status === 'active' || item.status === 'ended'
                          ? 'text-brand'
                          : 'text-text-primary'
                      }`}>
                        {formatPrice(priceInfo.price)}
                      </span>
                    </div>

                    {/* Action button */}
                    {isClickable && (
                      <div className="mt-2 flex items-center gap-2">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            item.status === 'active'
                              ? 'bg-brand text-white hover:bg-brand-hover shadow-sm'
                              : 'bg-white text-brand border border-brand/20 hover:bg-brand-50'
                          }`}
                        >
                          {item.status === 'active' ? '立即出价' : '去看看'}
                        </motion.button>
                        {isCurrent && (
                          <Badge className="bg-brand/10 text-brand border-0 text-[10px]">
                            <Eye className="w-3 h-3 mr-0.5" />
                            讲解中
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
              {idx < auctions.length - 1 && <Separator className="bg-gray-100 mt-2" />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
