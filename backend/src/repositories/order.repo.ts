import { db } from '../infrastructure/db/knex.js';

export const orderRepo = {
  async create(data: { session_id: number; buyer_id: number; product_id: number; final_price: number }) {
    const [id] = await db('orders').insert({ ...data, status: 'pending_payment' });
    return id;
  },

  async findById(id: number) {
    return db('orders').where({ id }).first();
  },

  async findByBuyer(buyerId: number, page = 1, limit = 20) {
    const q = db('orders').where({ buyer_id: buyerId });
    const total = await q.clone().count('* as cnt').first();
    const items = await q.orderBy('created_at', 'desc').offset((page - 1) * limit).limit(limit);
    return { items, total: Number((total as any)?.cnt || 0), page, limit };
  },

  async findByMerchantProductIds(productIds: number[], page = 1, limit = 20) {
    if (productIds.length === 0) return { items: [], total: 0, page, limit };
    const q = db('orders').whereIn('product_id', productIds);
    const total = await q.clone().count('* as cnt').first();
    const items = await q.orderBy('created_at', 'desc').offset((page - 1) * limit).limit(limit);
    return { items, total: Number((total as any)?.cnt || 0), page, limit };
  },

  async updateStatus(id: number, status: string) {
    return db('orders').where({ id }).update({ status, updated_at: db.fn.now() });
  },
};
