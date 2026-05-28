import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Gavel } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../design-system/components/ui/sheet';
import { Badge } from '../../design-system/components/ui/badge';
import { Button } from '../../design-system/components/ui/button';
import { formatPrice, getPriceLabel } from '../../lib/format';
import { AUCTION_STATUS_CONFIG } from '../../lib/statusConfig';
import type { RoomAuctionItem } from '../../types/api';

interface ProductDetailSheetProps {
  open: boolean;
  onClose: () => void;
  item: RoomAuctionItem | null;
  onBid: (item: RoomAuctionItem) => void;
}

const sheetVariants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: { type: 'spring', damping: 30, stiffness: 300 },
  },
  exit: {
    y: '100%',
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 0.15, duration: 0.2 },
  },
  exit: { opacity: 0 },
};

export default function ProductDetailSheet({
  open,
  onClose,
  item,
  onBid,
}: ProductDetailSheetProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBid = useCallback(() => {
    if (item && item.status === 'active') {
      onBid(item);
    }
  }, [item, onBid]);

  const productName = item?.product?.name ?? `商品 #${item?.sessionId ?? ''}`;
  const imageUrl = item?.product?.imageUrl;
  const productDescription = item?.product?.description;
  const isActive = item?.status === 'active';

  const priceInfo = useMemo(() => {
    if (!item) return null;
    return getPriceLabel(item);
  }, [item]);

  const statusCfg = useMemo(() => {
    if (!item) return AUCTION_STATUS_CONFIG.listed;
    return AUCTION_STATUS_CONFIG[item.status] ?? AUCTION_STATUS_CONFIG.listed;
  }, [item]);

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="bottom"
        className="bg-surface-card border-white/10 rounded-t-2xl h-[50vh] flex flex-col p-0 overflow-hidden"
      >
        <motion.div
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex flex-col h-full"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <SheetHeader className="px-5 pb-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-text-primary text-base font-semibold">
                商品详情
              </SheetTitle>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SheetDescription className="sr-only">
              查看商品详细信息和出价
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-auto">
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col"
            >
              {/* Product image with gradient overlay */}
              <div className="relative w-full h-48 bg-surface-secondary flex-shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">
                    📦
                  </div>
                )}
                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/60 to-transparent" />

                {/* Status badge overlaid on image */}
                <div className="absolute top-3 right-3">
                  <Badge
                    className={`${statusCfg.className} text-xs border px-2 py-0.5 backdrop-blur-sm`}
                  >
                    {statusCfg.label}
                  </Badge>
                  {isActive && (
                    <Badge className="bg-brand text-white border-0 text-xs px-2 py-0.5 ml-2 animate-pulse">
                      LIVE
                    </Badge>
                  )}
                </div>
              </div>

              {/* Product info */}
              <div className="px-5 -mt-8 relative z-10">
                <h3 className="text-text-primary font-bold text-lg leading-tight">
                  {productName}
                </h3>

                {productDescription && (
                  <p className="text-text-secondary text-sm mt-2 line-clamp-2">
                    {productDescription}
                  </p>
                )}

                {/* Price section */}
                {priceInfo && (
                  <div className="mt-4 p-3 rounded-xl bg-surface-elevated border border-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-text-tertiary text-xs">
                          {priceInfo.label}
                        </span>
                        <div className="text-brand font-bold text-xl mt-0.5">
                          {formatPrice(priceInfo.price)}
                        </div>
                      </div>

                      {/* Countdown placeholder */}
                      {isActive && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/20">
                          <Clock className="w-3.5 h-3.5 text-brand" />
                          <span className="text-brand text-sm font-medium font-mono">
                            --:--
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Auction details */}
                    {item.rule && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                        <div>
                          <span className="text-text-tertiary text-[10px]">
                            起拍价
                          </span>
                          <span className="block text-text-secondary text-xs font-medium">
                            {formatPrice(item.rule.startPrice)}
                          </span>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div>
                          <span className="text-text-tertiary text-[10px]">
                            加价幅度
                          </span>
                          <span className="block text-text-secondary text-xs font-medium">
                            {formatPrice(item.rule.bidIncrement)}
                          </span>
                        </div>
                        {item.rule.ceilingPrice != null && (
                          <>
                            <div className="w-px h-6 bg-white/10" />
                            <div>
                              <span className="text-text-tertiary text-[10px]">
                                封顶价
                              </span>
                              <span className="block text-text-secondary text-xs font-medium">
                                {formatPrice(item.rule.ceilingPrice)}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="w-px h-6 bg-white/10" />
                        <div>
                          <span className="text-text-tertiary text-[10px]">
                            延时次数
                          </span>
                          <span className="block text-text-secondary text-xs font-medium">
                            {item.extensionCount} 次
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Spacer to push button to bottom */}
              <div className="flex-1 min-h-4" />
            </motion.div>
          </div>

          {/* Action button */}
          <div className="px-5 pb-6 pt-2 flex-shrink-0 border-t border-white/5">
            <AnimatePresence mode="wait">
              {isActive ? (
                <motion.div
                  key="bid-button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Button
                    onClick={handleBid}
                    size="lg"
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-brand to-brand-hover hover:from-brand-hover hover:to-brand text-white font-bold text-lg shadow-[0_4px_20px_rgba(254,44,85,0.35)] hover:shadow-[0_6px_28px_rgba(254,44,85,0.5)] disabled:opacity-40 disabled:cursor-not-allowed border-0"
                  >
                    <span className="flex items-center gap-2">
                      <Gavel className="w-5 h-5" />
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-xs opacity-80">立即出价</span>
                        <span className="text-xl">
                          {priceInfo ? formatPrice(priceInfo.price) : '--'}
                        </span>
                      </span>
                    </span>
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="status-info"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-center py-4 rounded-xl bg-surface-elevated border border-white/5"
                >
                  <span className="text-text-tertiary text-sm">
                    {item.status === 'listed'
                      ? '拍卖尚未开始'
                      : item.status === 'ended'
                        ? '拍卖已结束'
                        : item.status === 'unsold'
                          ? '该商品已流拍'
                          : '拍卖已取消'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
