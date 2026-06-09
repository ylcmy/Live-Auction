import { db } from '../infrastructure/db/knex.js';
import { paginateQuery } from '../lib/paginate.js';

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
    return db('orders as o')
      .leftJoin('products as p', 'p.id', 'o.product_id')
      .leftJoin('users as u', 'u.id', 'o.buyer_id')
      .select('o.*', 'p.name as product_name', 'p.image_url as product_image_url', 'u.nickname as buyer_nickname')
      .where('o.id', id)
      .first();
  },

  async findBySessionId(sessionId: number) {
    return db('orders').where({ session_id: sessionId }).first();
  },

  async findByBuyer(buyerId: number, page = 1, limit = 20, status?: string) {
    let q = db('orders as o')
      .leftJoin('products as p', 'p.id', 'o.product_id')
      .leftJoin('users as u', 'u.id', 'o.buyer_id')
      .select('o.*', 'p.name as product_name', 'p.image_url as product_image_url', 'u.nickname as buyer_nickname')
      .where('o.buyer_id', buyerId);
    if (status) {
      q = q.where('o.status', status);
    }
    return paginateQuery(q, page, limit, { orderBy: ['o.created_at', 'desc'] });
  },

  async findByProductIds(productIds: number[], page = 1, limit = 20, status?: string) {
    if (productIds.length === 0) return { items: [], total: 0, page, limit };
    let q = db('orders as o')
      .leftJoin('products as p', 'p.id', 'o.product_id')
      .leftJoin('users as u', 'u.id', 'o.buyer_id')
      .select('o.*', 'p.name as product_name', 'p.image_url as product_image_url', 'u.nickname as buyer_nickname')
      .whereIn('o.product_id', productIds);
    if (status) {
      q = q.where('o.status', status);
    }
    return paginateQuery(q, page, limit, { orderBy: ['o.created_at', 'desc'] });
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
