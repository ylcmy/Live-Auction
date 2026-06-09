import { ORDER_STATUS_CONFIG } from './statusConfig';

/** @deprecated Use ORDER_STATUS_CONFIG from statusConfig instead */
export const ORDER_STATUS_MAP: Record<string, { label: string; className: string }> = Object.fromEntries(
  Object.entries(ORDER_STATUS_CONFIG).map(([key, val]) => [key, { label: val.label, className: val.className }])
);

export function getOrderDisplayStatus(order: { status: string; expireAt?: string; expire_at?: string }): string {
  const isExpired = order.status === 'pending_payment' &&
    ((order.expireAt && new Date(order.expireAt) < new Date()) ||
     (order.expire_at && new Date(order.expire_at) < new Date()));
  return isExpired ? 'expired' : order.status;
}

/** @deprecated Import from hooks/useOrderCountdown instead */
export { useOrderCountdown } from '../hooks/useOrderCountdown';
