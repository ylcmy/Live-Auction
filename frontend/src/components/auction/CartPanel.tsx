import { useState, useCallback, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../design-system/components/ui/sheet';
import { Badge } from '../../design-system/components/ui/badge';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
import { X, Package } from 'lucide-react';
import { useAuctionStore } from '../../store/auctionStore';
import ProductCard from './ProductCard';
import ProductDetailSheet from './ProductDetailSheet';
import BidSheet from './BidSheet';
import type { RoomAuctionItem } from '../../types/api';

interface CartPanelProps {
  open: boolean;
  onClose: () => void;
  auctions: RoomAuctionItem[];
  currentSessionId?: number;
  onSelectProduct: (item: RoomAuctionItem) => void;
}

export default function CartPanel({
  open,
  onClose,
  auctions,
  currentSessionId,
  onSelectProduct,
}: CartPanelProps) {
  const myBids = useAuctionStore((s) => s.myBids);
  const [bidSheetItem, setBidSheetItem] = useState<RoomAuctionItem | null>(null);
  const [bidSheetOpen, setBidSheetOpen] = useState(false);
  const [detailSheetItem, setDetailSheetItem] = useState<RoomAuctionItem | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // 自动将讲解中商品置顶，同时保持原始序号
  const sortedAuctions = useMemo(() => {
    if (!currentSessionId) return auctions;
    const currentIndex = auctions.findIndex((a) => a.sessionId === currentSessionId);
    if (currentIndex <= 0) return auctions;
    const result = [...auctions];
    const [currentItem] = result.splice(currentIndex, 1);
    result.unshift(currentItem);
    return result;
  }, [auctions, currentSessionId]);

  // 原始序号映射（基于原始 auctions 数组，不随排序改变）
  const originalIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    auctions.forEach((item, idx) => {
      map.set(item.sessionId, idx);
    });
    return map;
  }, [auctions]);

  // 检查 auctions 中是否有重复的 sessionId（开发调试使用）
  const duplicateSessionIds = useMemo(() => {
    const seen = new Set<number>();
    const duplicates = new Set<number>();
    auctions.forEach((item) => {
      if (seen.has(item.sessionId)) {
        duplicates.add(item.sessionId);
      } else {
        seen.add(item.sessionId);
      }
    });
    return duplicates;
  }, [auctions]);

  const handleSelect = useCallback(
    (item: RoomAuctionItem) => {
      onSelectProduct(item);
      setDetailSheetItem(item);
      setDetailSheetOpen(true);
    },
    [onSelectProduct],
  );

  const handleCloseDetailSheet = useCallback(() => {
    setDetailSheetOpen(false);
    setTimeout(() => setDetailSheetItem(null), 300);
  }, []);

  const handleBidFromDetail = useCallback(
    (item: RoomAuctionItem) => {
      handleCloseDetailSheet();
      setTimeout(() => {
        setBidSheetItem(item);
        setBidSheetOpen(true);
      }, 150);
    },
    [handleCloseDetailSheet],
  );

  const handleCloseBidSheet = useCallback(() => {
    setBidSheetOpen(false);
    setTimeout(() => setBidSheetItem(null), 300);
  }, []);

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side="bottom"
          className="bg-white border-gray-200 h-[80vh] flex flex-col p-0 rounded-t-xl"
        >
          <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-gray-900 text-base font-semibold">
                竞拍商品
              </SheetTitle>
              <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-0 text-[10px]">
                {auctions.length} 件
              </Badge>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            {auctions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Package className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">暂无商品</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  {sortedAuctions.map((item) => (
                    <ProductCard
                      key={item.sessionId}
                      item={item}
                      index={originalIndexMap.get(item.sessionId)}
                      isCurrent={item.sessionId === currentSessionId}
                      myLastBid={myBids[item.sessionId] ?? null}
                      onSelect={() => handleSelect(item)}
                      onBid={() => { setBidSheetItem(item); setBidSheetOpen(true); }}
                    />
                  ))}
                </div>
                {/* 开发调试：显示重复 sessionId 警告 */}
                {duplicateSessionIds.size > 0 && (
                  <div className="px-3 pb-3">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700">
                      警告：检测到重复的商品 sessionId: {[...duplicateSessionIds].join(', ')}
                    </div>
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ProductDetailSheet
        open={detailSheetOpen}
        onClose={handleCloseDetailSheet}
        item={detailSheetItem}
        onBid={handleBidFromDetail}
      />

      <BidSheet
        open={bidSheetOpen}
        onClose={handleCloseBidSheet}
        item={bidSheetItem}
        myLastBid={bidSheetItem ? myBids[bidSheetItem.sessionId] ?? null : null}
      />
    </>
  );
}
