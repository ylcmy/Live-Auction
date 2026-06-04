import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Gavel } from 'lucide-react';
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

const STATUS_MESSAGES: Record<string, string> = {
  listed: '拍卖尚未开始',
  ended: '拍卖已结束',
  unsold: '该商品已流拍',
  cancelled: '拍卖已取消',
};

function getStatusMessage(status: string): string {
  return STATUS_MESSAGES[status] ?? '拍卖已结束';
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
        className="bg-white border-gray-200 rounded-t-2xl h-[50vh] flex flex-col p-0 overflow-hidden"
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
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <SheetHeader className="px-5 pb-3 border-b border-gray-100 flex-shrink-0 flex flex-row items-center justify-between">
            <SheetTitle className="text-gray-900 text-base font-semibold">
              商品详情
            </SheetTitle>
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
              <div className="relative w-full h-48 bg-gray-100 flex-shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />

                {/* Status badge overlaid on image */}
                <div className="absolute top-3 right-3">
                  <Badge
                    className={`${statusCfg.className} text-xs border px-2 py-0.5 backdrop-blur-sm`}
                  >
                    {statusCfg.label}
                  </Badge>
                  {isActive && (
                    <Badge className="bg-red-500 text-white border-0 text-xs px-2 py-0.5 ml-2 animate-pulse">
                      LIVE
                    </Badge>
                  )}
                </div>
              </div>

              {/* Product info */}
              <div className="px-5 -mt-8 relative z-10">
                <h3 className="text-gray-900 font-bold text-lg leading-tight">
                  {productName}
                </h3>

                {productDescription && (
                  <p className="text-gray-500 text-sm mt-2 line-clamp-2">
                    {productDescription}
                  </p>
                )}

                {/* Price section */}
                {priceInfo && (
                  <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-gray-400 text-xs">
                          {priceInfo.label}
                        </span>
                        <div className="text-red-500 font-bold text-xl mt-0.5">
                          {formatPrice(priceInfo.price)}
                        </div>
                      </div>

                      {/* Countdown placeholder */}
                      {isActive && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100">
                          <Clock className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-red-500 text-sm font-medium font-mono">
                            --:--
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Auction details */}
                    {item.rule && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                        <div>
                          <span className="text-gray-400 text-[10px]">
                            起拍价
                          </span>
                          <span className="block text-gray-700 text-xs font-medium">
                            {formatPrice(item.rule.startPrice)}
                          </span>
                        </div>
                        <div className="w-px h-6 bg-gray-200" />
                        <div>
                          <span className="text-gray-400 text-[10px]">
                            加价幅度
                          </span>
                          <span className="block text-gray-700 text-xs font-medium">
                            {formatPrice(item.rule.bidIncrement)}
                          </span>
                        </div>
                        {item.rule.ceilingPrice != null && (
                          <>
                            <div className="w-px h-6 bg-gray-200" />
                            <div>
                              <span className="text-gray-400 text-[10px]">
                                封顶价
                              </span>
                              <span className="block text-gray-700 text-xs font-medium">
                                {formatPrice(item.rule.ceilingPrice)}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="w-px h-6 bg-gray-200" />
                        <div>
                          <span className="text-gray-400 text-[10px]">
                            延时次数
                          </span>
                          <span className="block text-gray-700 text-xs font-medium">
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
          <div className="px-5 pb-6 pt-2 flex-shrink-0 border-t border-gray-100">
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
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold text-lg shadow-[0_4px_20px_rgba(239,68,68,0.35)] hover:shadow-[0_6px_28px_rgba(239,68,68,0.5)] disabled:opacity-40 disabled:cursor-not-allowed border-0"
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
                  className="flex items-center justify-center py-4 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <span className="text-gray-400 text-sm">
                    {getStatusMessage(item.status)}
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
