import { db } from '../infrastructure/db/knex.js';

export const orderRepo = {
  async create(data: { session_id: number; buyer_id: number; product_id: number; final_price: number }) {
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);
    const [id] = await db('orders').insert({
      ...data,
      status: 'pending_payment',
      expire_at: expireAt,
    });
    return id;
  },

  async findById(id: number) {
    return db('orders').where({ id }).first();
  },

  async findByBuyer(buyerId: number, page = 1, limit = 20, status?: string) {
    let q = db('orders').where({ buyer_id: buyerId });
    if (status) {
      q = q.where({ status });
    }
    const total = await q.clone().count('* as cnt').first();
    const items = await q.orderBy('created_at', 'desc').offset((page - 1) * limit).limit(limit);
    return { items, total: Number((total as any)?.cnt || 0), page, limit };
  },

  async findByMerchantProductIds(productIds: number[], page = 1, limit = 20, status?: string) {
    if (productIds.length === 0) return { items: [], total: 0, page, limit };
    let q = db('orders').whereIn('product_id', productIds);
    if (status) {
      q = q.where({ status });
    }
    const total = await q.clone().count('* as cnt').first();
    const items = await q.orderBy('created_at', 'desc').offset((page - 1) * limit).limit(limit);
    return { items, total: Number((total as any)?.cnt || 0), page, limit };
  },

  async updateStatus(id: number, status: string, extra: Record<string, any> = {}) {
    return db('orders').where({ id }).update({ status, ...extra, updated_at: db.fn.now() });
  },

  async findExpiredPendingOrders() {
    return db('orders')
      .where({ status: 'pending_payment' })
      .where('expire_at', '<', db.fn.now())
      .select('*');
  },
};
