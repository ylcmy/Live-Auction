import { orderRepo } from '../repositories/order.repo.js';
import { productRepo } from '../repositories/product.repo.js';

export const orderService = {
  async getOrders(userId: number, role: 'merchant' | 'user', page = 1, limit = 20) {
    if (role === 'user') return orderRepo.findByBuyer(userId, page, limit);
    // Merchant: get orders for their products
    const products = await productRepo.findAll({ merchant_id: userId, limit: 1000 });
    const productIds = products.items.map((p: any) => p.id);
    return orderRepo.findByMerchantProductIds(productIds, page, limit);
  },

  async getOrderDetail(orderId: number) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    return order;
  },

  async mockPay(orderId: number) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw Object.assign(new Error('订单不存在'), { statusCode: 404 });
    if (order.status !== 'pending_payment') throw Object.assign(new Error('订单状态不正确'), { statusCode: 409 });
    await orderRepo.updateStatus(orderId, 'paid');
    return { orderId, status: 'paid', paidAt: new Date().toISOString() };
  },
};
