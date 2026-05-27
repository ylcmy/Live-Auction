import { db } from '../infrastructure/db/knex.js';

export const liveRoomRepo = {
  async create(data: { host_id: number; title: string; stream_url?: string }): Promise<number> {
    const [id] = await db('live_rooms').insert({ ...data, status: 'offline' });
    return Number(id);
  },
  async findById(id: number) {
    return db('live_rooms').where({ id }).first();
  },
  async findByHost(hostId: number) {
    return db('live_rooms').where({ host_id: hostId }).first();
  },
  async findAll(filters: { host_id?: number; status?: string; page?: number; limit?: number } = {}) {
    const { host_id, status, page = 1, limit = 20 } = filters;
    let query = db('live_rooms');
    if (host_id) query = query.where({ host_id });
    if (status) query = query.where({ status });
    const total = await query.clone().count('* as count').first();
    const items = await query.orderBy('created_at', 'desc').offset((page - 1) * limit).limit(limit);
    return { items, total: Number((total as any)?.count || 0), page, limit };
  },
  async updateStatus(id: number, status: 'offline' | 'live') {
    return db('live_rooms').where({ id }).update({ status });
  },
  async update(id: number, data: { title?: string; stream_url?: string }) {
    return db('live_rooms').where({ id }).update({ ...data, updated_at: db.fn.now() });
  },
};
