import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../design-system/components/ui/sheet';
import { Badge } from '../../design-system/components/ui/badge';
import { ScrollArea } from '../../design-system/components/ui/scroll-area';
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
  roomId: number;
  onSelectProduct: (item: RoomAuctionItem) => void;
  onBid: (item: RoomAuctionItem) => void;
}

export default function CartPanel({
  open,
  onClose,
  auctions,
  currentSessionId,
  roomId,
  onSelectProduct,
  onBid,
}: CartPanelProps) {
  const myBids = useAuctionStore((s) => s.myBids);
  const [bidSheetItem, setBidSheetItem] = useState<RoomAuctionItem | null>(null);
  const [bidSheetOpen, setBidSheetOpen] = useState(false);
  const [detailSheetItem, setDetailSheetItem] = useState<RoomAuctionItem | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

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

  const handleBid = useCallback(
    (item: RoomAuctionItem) => {
      onBid(item);
      setBidSheetItem(item);
      setBidSheetOpen(true);
    },
    [onBid],
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
          className="bg-surface-card border-white/10 h-[70vh] flex flex-col p-0 rounded-t-xl"
        >
          <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-text-primary text-base font-semibold">
                竞拍商品
              </SheetTitle>
              <Badge variant="secondary" className="bg-surface-secondary text-text-tertiary border-0 text-[10px]">
                {auctions.length} 件
              </Badge>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-elevated text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            {auctions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-text-tertiary text-sm">暂无商品</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-3 space-y-2">
                  {auctions.map((item) => (
                    <ProductCard
                      key={item.sessionId}
                      item={item}
                      isCurrent={item.sessionId === currentSessionId}
                      myLastBid={myBids[item.sessionId] ?? null}
                      onSelect={() => handleSelect(item)}
                      onBid={() => handleBid(item)}
                    />
                  ))}
                </div>
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
        roomId={roomId}
      />
    </>
  );
}
