import { AUCTION_STATUS_CONFIG } from './statusConfig';

export function formatPrice(price: number | string | undefined | null): string {
  if (price == null) return '¥--';
  const num = typeof price === 'string' ? Number(price) : price;
  if (Number.isNaN(num)) return '¥--';
  return `¥${num.toFixed(2)}`;
}

/**
 * 将毫秒格式化为紧凑的 MM:SS 形式（用于小尺寸 UI）。
 */
export function formatMsCompact(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatMs(ms: number): string {
  return `${formatMsCompact(ms)}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN');
}

export function getPriceLabel(item: { status: string; currentPrice: number; rule: { startPrice: number } }): { label: string; price: number } {
  const priceLabel = AUCTION_STATUS_CONFIG[item.status as keyof typeof AUCTION_STATUS_CONFIG]?.priceLabel ?? '起拍价';
  if (item.status === 'active' && item.currentPrice > item.rule.startPrice) {
    return { label: '当前最高价', price: item.currentPrice };
  }
  return { label: priceLabel, price: item.status === 'ended' ? item.currentPrice : item.rule.startPrice };
}
