import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatMsCompact, formatPrice, getPriceLabel } from '../../lib/format';
import { useAuctionStore } from '../../store/auctionStore';
import type { RoomAuctionItem } from '../../types/api';

interface ProductCardProps {
  item: RoomAuctionItem;
  isCurrent: boolean;
  myLastBid: number | null;
  onSelect: () => void;
  onBid: () => void;
  index?: number;
}

// CSS 音频波形动画组件
function AudioWaveform() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-[2px] bg-white rounded-full"
          animate={{
            height: ['4px', '10px', '6px', '12px', '4px'],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export default function ProductCard({ item, isCurrent, myLastBid: _myLastBid, onSelect, onBid, index }: ProductCardProps) {
  const { label: priceLabel, price: displayPrice } = getPriceLabel(item);
  const isActive = item.status === 'active';

  const countdownRemainingMs = useAuctionStore((s) => s.countdownRemainingMs);
  const currentAuction = useAuctionStore((s) => s.currentAuction);
  const isCurrentActive = isCurrent && isActive && currentAuction?.sessionId === item.sessionId;

  // 状态标签颜色映射
  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'bg-red-500', text: 'text-white' },
    listed: { bg: 'bg-orange-400', text: 'text-white' },
    ended: { bg: 'bg-gray-400', text: 'text-white' },
    unsold: { bg: 'bg-gray-400', text: 'text-white' },
    cancelled: { bg: 'bg-gray-400', text: 'text-white' },
  };
  const colors = statusColors[item.status] ?? statusColors.listed;

  // 状态标签文字映射
  const statusLabels: Record<string, string> = {
    active: '竞拍中',
    listed: '即将开拍',
    ended: '已成交',
    unsold: '流拍',
    cancelled: '已取消',
  };
  const statusLabel = statusLabels[item.status] ?? '即将开拍';

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* 左侧：序号 + 图片 */}
        <div className="relative flex-shrink-0">
          <div className="relative overflow-hidden rounded-lg">
            {item.product?.imageUrl ? (
              <img
                src={item.product.imageUrl}
                alt={item.product.name}
                className="w-24 h-24 rounded-lg object-cover bg-gray-100"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )}

            {/* 序号标签 */}
            {index !== undefined && (
              <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 rounded-md flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">{index + 1}</span>
              </div>
            )}

            {/* 讲解中渐变条带 */}
            {isCurrentActive && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-red-500 via-red-500 to-pink-500 px-2 py-1 flex items-center justify-center gap-1.5">
                <AudioWaveform />
                <span className="text-white text-[10px] font-medium">讲解中</span>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：商品信息 */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            {/* 商品名称 */}
            <h3 className="text-gray-900 text-sm font-medium leading-tight line-clamp-2">
              {item.product?.name ?? `商品 #${item.sessionId}`}
            </h3>

            {/* 状态标签 + 倒计时 */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className={`${colors.bg} ${colors.text} text-[10px] px-1.5 py-0.5 rounded font-medium`}>
                {statusLabel}
              </span>
              {isCurrentActive && countdownRemainingMs > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-red-500">
                  <Clock className="w-3 h-3" />
                  {formatMsCompact(countdownRemainingMs)}
                </span>
              )}
            </div>
          </div>

          {/* 价格和操作 */}
          <div className="flex items-end justify-between mt-2">
            <div className="flex items-baseline gap-1">
                <span className="text-red-500 font-bold text-base">¥{formatPrice(displayPrice).replace('¥', '')}</span>
                <span className="text-gray-400 text-[11px]">{priceLabel}</span>
              </div>

            {/* 操作按钮：竞拍中显示"去出价"，其他所有状态显示"去看看" */}
            {isActive ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBid();
                }}
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:from-red-600 hover:to-pink-600 transition-all shadow-sm flex-shrink-0"
              >
                去出价
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:from-red-600 hover:to-pink-600 transition-all shadow-sm flex-shrink-0"
              >
                去看看
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
