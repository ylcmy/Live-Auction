export function formatPrice(price: number | string | undefined | null): string {
  if (price == null) return '¥--';
  const num = typeof price === 'string' ? Number(price) : price;
  if (Number.isNaN(num)) return '¥--';
  return `¥${num.toFixed(2)}`;
}

export function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const remainMs = ms % 1000;
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(remainMs).padStart(3, '0')}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN');
}

export function getPriceLabel(item: { status: string; currentPrice: number; rule: { startPrice: number } }): { label: string; price: number } {
  switch (item.status) {
    case 'listed':
      return { label: '起拍价', price: item.rule.startPrice };
    case 'active':
      return item.currentPrice > item.rule.startPrice
        ? { label: '当前最高价', price: item.currentPrice }
        : { label: '起拍价', price: item.rule.startPrice };
    case 'ended':
      return { label: '落槌价', price: item.currentPrice };
    case 'unsold':
      return { label: '起拍价', price: item.rule.startPrice };
    case 'cancelled':
      return { label: '起拍价', price: item.rule.startPrice };
    default:
      return { label: '起拍价', price: item.rule.startPrice };
  }
}
