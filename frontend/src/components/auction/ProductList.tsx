import { formatPrice } from '../../lib/format';
import { Badge } from '../../design-system/components/ui/badge';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
import { Separator } from '../../design-system/components/ui/separator';
import type { RoomAuctionItem } from '../../types/api';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: '待拍', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  active: { label: '竞拍中', className: 'bg-brand/20 text-brand border-brand/30' },
  ended: { label: '已成交', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  unsold: { label: '流拍', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  cancelled: { label: '已取消', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

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
          const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
          const isCurrent = item.sessionId === currentSessionId;
          const isClickable = ['pending', 'active'].includes(item.status) && onSelectAuction;

          return (
            <div key={item.sessionId}>
              <div
                onClick={isClickable ? () => onSelectAuction(item) : undefined}
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
                      className="w-10 h-10 rounded-md object-cover bg-surface-secondary flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-surface-secondary flex items-center justify-center text-lg flex-shrink-0">
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

                    <div className="flex items-center gap-3 mt-1 text-xs">
                      {item.status === 'active' || item.status === 'ended' ? (
                        <span className="text-brand font-semibold">
                          {formatPrice(item.currentPrice)}
                        </span>
                      ) : (
                        <span className="text-text-tertiary">
                          起拍 {formatPrice(item.rule.startPrice)}
                        </span>
                      )}
                      {item.rule.ceilingPrice != null && item.rule.ceilingPrice > 0 && (
                        <span className="text-text-tertiary">
                          封顶 {formatPrice(item.rule.ceilingPrice)}
                        </span>
                      )}
                    </div>

                    {isClickable && !isCurrent && (
                      <div className="mt-1.5">
                        <span className="text-brand text-[11px] font-medium">点击参与竞拍 →</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {idx < auctions.length - 1 && <Separator className="bg-white/5 mt-2" />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
