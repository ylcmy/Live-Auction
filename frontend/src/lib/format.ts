export function formatPrice(price: number | string): string {
  return `¥${Number(price).toFixed(2)}`;
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
