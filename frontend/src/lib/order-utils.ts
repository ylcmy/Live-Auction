export function getOrderDisplayStatus(order: { status: string; expireAt?: string; expire_at?: string }): string {
  const isExpired = order.status === 'pending_payment' &&
    ((order.expireAt && new Date(order.expireAt) < new Date()) ||
     (order.expire_at && new Date(order.expire_at) < new Date()));
  return isExpired ? 'expired' : order.status;
}
