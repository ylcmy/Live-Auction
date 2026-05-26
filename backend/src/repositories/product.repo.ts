import { db } from '../infrastructure/db/knex.js';

export const productRepo = {
  async create(data: {
    merchant_id: number;
    name: string;
    description?: string;
    image_url?: string;
    category?: string;
  }): Promise<number> {
    const [id] = await db('products').insert({ ...data, status: 'draft' });
    return id;
  },

  async findById(id: number) {
    return db('products').where({ id }).first();
  },

  async findAll(
    filters: {
      merchant_id?: number;
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { merchant_id, status, page = 1, limit = 20 } = filters;
    let query = db('products');

    if (merchant_id) query = query.where({ merchant_id });
    if (status) query = query.where({ status });

    const total = await query.clone().count('* as count').first();
    const items = await query
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    return {
      items,
      total: Number((total as any)?.count || 0),
      page,
      limit,
    };
  },

  async updateStatus(id: number, status: string) {
    return db('products').where({ id }).update({ status, updated_at: db.fn.now() });
  },
};
