import { useEffect, useState, useCallback, useRef } from 'react';
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
import { useAuctionStore } from '../../store/auctionStore';
import { formatPrice } from '../../lib/format';
import { getSocket } from '../../services/socket';
import BidStepper from './BidStepper';
import BidHint from './BidHint';
import type { RoomAuctionItem } from '../../types/api';
import type { BidResult } from '../../types/ws';

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
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const endedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const setMyBid = useAuctionStore((s) => s.setMyBid);
  const updateAuctionPrice = useAuctionStore((s) => s.updateAuctionPrice);

  const currentPrice = Number(item?.currentPrice) || 0;
  const bidIncrement = Number(item?.rule?.bidIncrement) || 1;

  const { bidAmount, setValue, reset, snapToMin } =
    useBidAmount(currentPrice, bidIncrement);

  const { submitBid } = useBid(item?.sessionId ?? null);

  // Reset state when sheet opens with a new item
  useEffect(() => {
    if (open && item) {
      reset();
      setBidSuccess(false);
      setIsSubmitting(false);
    }
  }, [open, item?.sessionId, reset]);

  // Subscribe to bid:accepted
  useEffect(() => {
    if (!open || !item) return;

    const socket = getSocket();
    if (!socket) return;

    const handler = (data: BidResult) => {
      if (data.sessionId === item.sessionId) {
        setMyBid(data.sessionId, data.amount);
        setBidSuccess(true);
        setIsSubmitting(false);
        setIsOutbid(false);

        // Update price in room auctions
        updateAuctionPrice(data.sessionId, data.amount);

        // Auto-dismiss success after 1.5s
        clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => {
          setBidSuccess(false);
        }, 1500);
      }
    };

    socket.on('bid:accepted', handler);

    return () => {
      socket.off('bid:accepted', handler);
      clearTimeout(successTimerRef.current);
    };
  }, [open, item, setMyBid, updateAuctionPrice]);

  // Subscribe to bid:new for real-time price updates and outbid detection
  useEffect(() => {
    if (!open || !item) return;

    const socket = getSocket();
    if (!socket) return;

    const handler = (data: { sessionId: number; amount: number; newTopBid: boolean }) => {
      if (data.sessionId === item.sessionId && data.newTopBid) {
        // Update price in store
        updateAuctionPrice(data.sessionId, data.amount);
        // Snap bid amount to new minimum if outbid
        snapToMin(data.amount);

        // Flash outbid indicator if the new bid is not from us
        if (myLastBid == null || data.amount > myLastBid) {
          setIsOutbid(true);
          setTimeout(() => setIsOutbid(false), 800);
        }
      }
    };

    socket.on('bid:new', handler);

    return () => {
      socket.off('bid:new', handler);
    };
  }, [open, item, updateAuctionPrice, snapToMin, myLastBid]);

  const handleClose = useCallback(() => {
    setBidSuccess(false);
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  // Subscribe to auction:ended
  useEffect(() => {
    if (!open || !item) return;

    const socket = getSocket();
    if (!socket) return;

    const handler = (data: { sessionId: number; status: string; winner?: { userNickname: string; finalPrice: number } }) => {
      if (data.sessionId === item.sessionId) {
        // Auto-dismiss after 3s
        clearTimeout(endedTimerRef.current);
        endedTimerRef.current = setTimeout(() => {
          handleClose();
        }, 3000);
      }
    };

    socket.on('auction:ended', handler);

    return () => {
      socket.off('auction:ended', handler);
      clearTimeout(endedTimerRef.current);
    };
  }, [open, item, handleClose]);

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
