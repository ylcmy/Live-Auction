import { orderRepo } from '../repositories/order.repo.js';
import { productRepo } from '../repositories/product.repo.js';
import { AppError } from '../lib/app-error.js';

export const orderService = {
  async getOrders(userId: number, role: 'merchant' | 'user', page = 1, limit = 20) {
    if (role === 'user') return orderRepo.findByBuyer(userId, page, limit);
    const products = await productRepo.findAll({ merchant_id: userId, limit: 1000 });
    const productIds = products.items.map((p: any) => p.id);
    return orderRepo.findByMerchantProductIds(productIds, page, limit);
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
    await orderRepo.updateStatus(orderId, 'paid');
    return { orderId, status: 'paid', paidAt: new Date().toISOString() };
  },

  async updateStatus(orderId: number, newStatus: string) {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      pending_payment: ['paid', 'cancelled'],
      paid: ['cancelled'],
      cancelled: ['pending_payment'],
    };
    const order = await orderRepo.findById(orderId);
    if (!order) throw new AppError('订单不存在', 404);
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(`订单状态不可从 ${order.status} 变为 ${newStatus}`, 409);
    }
    await orderRepo.updateStatus(orderId, newStatus);
    return { orderId, status: newStatus };
  },
};
