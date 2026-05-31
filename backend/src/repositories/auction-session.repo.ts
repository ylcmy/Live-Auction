import { db } from '../infrastructure/db/knex.js';

export const auctionSessionRepo = {
  async create(data: { product_id: number; rule_id: number; room_id: number; current_price?: number }) {
    const [id] = await db('auction_sessions').insert({
      ...data,
      status: 'active',
      current_price: data.current_price ?? 0.00,
      started_at: db.fn.now(),
    });
    return id as number;
  },
  async findById(id: number) {
    return db('auction_sessions').where({ id }).first();
  },
  async findActiveByRoom(roomId: number) {
    return db('auction_sessions').where({ room_id: roomId }).whereIn('status', ['pending', 'active']).first();
  },
  async updateStatus(id: number, status: string, extra: Record<string, any> = {}) {
    return db('auction_sessions').where({ id }).update({ status, ...extra, updated_at: db.fn.now() });
  },
  async updatePrice(id: number, price: number, winnerId?: number) {
    const update: any = { current_price: price, updated_at: db.fn.now() };
    if (winnerId) update.winner_id = winnerId;
    return db('auction_sessions').where({ id }).update(update).increment('version', 1);
  },
  async findAll(filters: { room_id?: number; status?: string; page?: number; limit?: number } = {}) {
    const { room_id, status, page = 1, limit = 20 } = filters;
    let query = db('auction_sessions');
    if (room_id) query = query.where({ room_id });
    if (status) query = query.where({ status });
    const total = await query.clone().count('* as count').first();
    const items = await query.orderBy('created_at', 'desc').offset((page - 1) * limit).limit(limit);
    return { items, total: Number((total as any)?.count || 0), page, limit };
  },
};
