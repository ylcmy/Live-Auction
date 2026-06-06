import { orderRepo } from '../repositories/order.repo.js';
import { productRepo } from '../repositories/product.repo.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../middleware/logger.js';

function generateTransactionId(): string {
  return `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export const orderService = {
  async getOrders(userId: number, role: 'merchant' | 'user', page = 1, limit = 20, status?: string) {
    if (role === 'user') return orderRepo.findByBuyer(userId, page, limit, status);
    const products = await productRepo.findAll({ merchant_id: userId, limit: 1000 });
    const productIds = products.items.map((p: any) => p.id);
    return orderRepo.findByMerchantProductIds(productIds, page, limit, status);
  },

  async getOrderDetail(orderId: number) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError('订单不存在', 404);
    return order;
  },

  async mockPay(orderId: number) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError('订单不存在', 404);
    if (order.status !== 'pending_payment') throw new AppError('订单状态不正确', 409);

    const now = new Date();
    const transactionId = generateTransactionId();

    await orderRepo.updateStatus(orderId, 'completed', {
      paid_at: now,
      completed_at: now,
      payment_method: 'mock',
      transaction_id: transactionId,
    });

    logger.info({ event: 'order_paid', orderId, transactionId }, 'Order paid and completed');

    return {
      orderId,
      status: 'completed',
      paidAt: now.toISOString(),
      completedAt: now.toISOString(),
      transactionId,
      paymentMethod: 'mock',
    };
  },

  async updateStatus(orderId: number, newStatus: string) {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      pending_payment: ['paid', 'cancelled'],
      paid: ['completed'],
      cancelled: [],
      completed: [],
    };

    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError('订单不存在', 404);

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(`订单状态不可从 ${order.status} 变为 ${newStatus}`, 409);
    }

    const extra: Record<string, any> = {};
    const now = new Date();
    if (newStatus === 'cancelled') {
      extra.cancelled_at = now;
    } else if (newStatus === 'paid') {
      extra.paid_at = now;
      extra.transaction_id = generateTransactionId();
      extra.payment_method = 'mock';
    } else if (newStatus === 'completed') {
      extra.completed_at = now;
    }

    await orderRepo.updateStatus(orderId, newStatus, extra);
    return { orderId, status: newStatus };
  },

  async autoCancelExpiredOrders(): Promise<number> {
    const expiredOrders = await orderRepo.findExpiredPendingOrders();
    let count = 0;
    for (const order of expiredOrders) {
      try {
        await orderRepo.updateStatus(order.id, 'cancelled', { cancelled_at: new Date() });
        count++;
        logger.info({ event: 'order_auto_cancelled', orderId: order.id }, 'Expired order auto-cancelled');
      } catch (err) {
        logger.error({ event: 'order_auto_cancel_failed', orderId: order.id, err }, 'Failed to auto-cancel expired order');
      }
    }
    return count;
  },
};
