import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Crown } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../design-system/components/ui/sheet';
import { Button } from '../../design-system/components/ui/button';
import { useBidAmount } from '../../hooks/useBidAmount';
import { useBid } from '../../hooks/useBid';
import { useAuctionEvents } from '../../hooks/useAuctionEvents';
import { useTimers } from '../../hooks/useTimers';
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import BidStepper from './BidStepper';
import BidHint from './BidHint';
import type { RoomAuctionItem } from '../../types/api';

interface BidSheetProps {
  open: boolean;
  onClose: () => void;
  item: RoomAuctionItem | null;
  myLastBid: number | null;
}

export default function BidSheet({ open, onClose, item, myLastBid }: BidSheetProps) {
  const [bidSuccess, setBidSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutbid, setIsOutbid] = useState(false);
  const setMyBid = useAuctionStore((s) => s.setMyBid);
  const updateAuctionPrice = useAuctionStore((s) => s.updateAuctionPrice);

  const currentPrice = Number(item?.currentPrice) || 0;
  const bidIncrement = Number(item?.rule?.bidIncrement) || 1;

  const { bidAmount, setValue, reset, snapToMin } =
    useBidAmount(currentPrice, bidIncrement);

  const { submitBid, bidError, clearBidError } = useBid(item?.sessionId ?? null);

  const { setTimer, clearAllTimers } = useTimers();

  const handleClose = useCallback(() => {
    setBidSuccess(false);
    setIsSubmitting(false);
    clearAllTimers();
    onClose();
  }, [onClose, clearAllTimers]);

  // All auction WS event handlers in one place — uses ref internally so
  // handlers always see latest closures without re-subscribing.
  const handlers = useMemo(() => ({
    onBidAccepted: (data: { sessionId: number; amount: number }) => {
      setMyBid(data.sessionId, data.amount);
      setBidSuccess(true);
      setIsSubmitting(false);
      setIsOutbid(false);
      updateAuctionPrice(data.sessionId, data.amount);
      setTimer('bidSuccess', () => setBidSuccess(false), 1500);
    },
    onBidNew: (data: { sessionId: number; amount: number }) => {
      updateAuctionPrice(data.sessionId, data.amount);
      snapToMin(data.amount);
      if (myLastBid != null && data.amount > myLastBid) {
        setIsOutbid(true);
        setTimer('outbid', () => setIsOutbid(false), 800);
      }
    },
    onAuctionEnded: () => {
      setTimer('auctionEnded', () => handleClose(), 3000);
    },
  }), [setMyBid, updateAuctionPrice, snapToMin, myLastBid, setTimer, handleClose]);

  useAuctionEvents(item?.sessionId ?? null, open, handlers);

  // Reset state when sheet opens with a new item
  // Use ref to track open transitions, avoiding re-trigger on reset() ref change
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current && item) {
      reset();
      setBidSuccess(false);
      setIsSubmitting(false);
      clearBidError();
    }
    prevOpenRef.current = open;
  }, [open, item?.sessionId]);

  // Auto-clear bid error after 3 seconds
  useEffect(() => {
    if (!bidError) return;
    const timer = setTimeout(clearBidError, 3000);
    return () => clearTimeout(timer);
  }, [bidError, clearBidError]);

  const handleSubmit = useCallback(() => {
    if (!item || isSubmitting) return;
    setIsSubmitting(true);
    submitBid(bidAmount);
  }, [item, isSubmitting, submitBid, bidAmount]);

  if (!item) return null;

  const productName = item.product?.name ?? `商品 #${item.sessionId}`;
  const imageUrl = item.product?.imageUrl;
  const myBidDisplay = myLastBid != null ? formatPrice(myLastBid) : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="bottom"
        className="bg-white border-gray-200 rounded-t-3xl h-[60vh] flex flex-col p-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <SheetHeader className="px-5 pb-3 border-b border-gray-100">
          <SheetTitle className="text-text-primary text-base font-semibold flex items-center gap-2">
            <Crown className="w-5 h-5 text-brand" />
            确认出价
          </SheetTitle>
          <SheetDescription className="sr-only">
            调整出价金额并确认竞拍
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-auto">
          {/* Summary section */}
          <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                className="w-16 h-16 rounded-xl object-cover bg-gray-100 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                📦
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-semibold text-sm truncate">
                {productName}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <div>
                  <span className="text-text-tertiary text-xs">当前价</span>
                  <span className={`font-bold text-base ml-1 transition-colors ${isOutbid ? 'text-red-500 animate-pulse' : 'text-brand'}`}>
                    {formatPrice(currentPrice)}
                  </span>
                </div>
                <div className="w-px h-6 bg-gray-200" />
                <div>
                  <span className="text-text-tertiary text-xs">我的出价</span>
                  <span className="text-brand font-bold text-base ml-1">
                    {myBidDisplay ?? '未出价'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stepper section */}
          <div className="px-5 py-2">
            <BidStepper
              value={bidAmount}
              min={currentPrice + bidIncrement}
              step={bidIncrement}
              onChange={setValue}
            />
          </div>

          {/* Hint section */}
          <div className="px-5">
            <BidHint
              bidAmount={bidAmount}
              currentPrice={currentPrice}
              isLeading={myLastBid != null && myLastBid >= currentPrice}
            />
          </div>

          {/* Action section */}
          <div className="px-5 pt-2 pb-6 mt-auto">
            {/* Bid error message */}
            <AnimatePresence>
              {bidError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mb-3 text-center text-red-500 text-sm font-medium bg-red-50 rounded-xl py-2 px-3"
                  onClick={clearBidError}
                >
                  {bidError}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {bidSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-50 border border-emerald-200"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  >
                    <Check className="w-6 h-6 text-emerald-500" strokeWidth={3} />
                  </motion.div>
                  <span className="text-emerald-600 font-semibold text-base">出价成功</span>
                </motion.div>
              ) : (
                <motion.div
                  key="submit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || item.status !== 'active'}
                    size="lg"
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-brand via-brand-hover to-brand text-white font-bold text-lg shadow-glow-brand hover:shadow-glow-brand-lg disabled:opacity-40 disabled:cursor-not-allowed border-0 overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <span className="relative flex flex-col items-center leading-tight">
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⟳</span>
                          提交中...
                        </span>
                      ) : (
                        <>
                          <span className="text-xs opacity-90">确认出价</span>
                          <span className="text-xl">{formatPrice(bidAmount)}</span>
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
