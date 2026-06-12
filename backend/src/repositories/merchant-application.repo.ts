import { db } from '../infrastructure/db/knex.js';

export interface MerchantApplicationRow {
  id: number;
  user_id: number;
  shop_name: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id: number | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const merchantApplicationRepo = {
  async create(data: {
    user_id: number;
    shop_name: string;
    reason?: string | null;
  }): Promise<number> {
    const [id] = await db('merchant_applications').insert({
      user_id: data.user_id,
      shop_name: data.shop_name,
      reason: data.reason ?? null,
    });
    return id as number;
  },

  async findById(id: number): Promise<MerchantApplicationRow | undefined> {
    return db('merchant_applications').where({ id }).first();
  },

  async findByUser(userId: number): Promise<MerchantApplicationRow | undefined> {
    return db('merchant_applications').where({ user_id: userId }).first();
  },

  async findByStatus(
    status: 'pending' | 'approved' | 'rejected',
    page = 1,
    limit = 20,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;

    const countResult = await db('merchant_applications')
      .where({ status })
      .count('id as count')
      .first();

    const total = Number(countResult?.count ?? 0);

    const items = await db('merchant_applications')
      .join('users', 'users.id', 'merchant_applications.user_id')
      .where('merchant_applications.status', status)
      .select(
        'merchant_applications.*',
        'users.username',
        'users.nickname',
      )
      .orderBy('merchant_applications.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return { items, total, page, limit };
  },

  async updateStatus(
    id: number,
    status: 'approved' | 'rejected',
    reviewerId: number,
  ): Promise<void> {
    await db('merchant_applications').where({ id }).update({
      status,
      reviewer_id: reviewerId,
      reviewed_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  },

  async resubmit(
    id: number,
    data: { shop_name: string; reason?: string | null },
  ): Promise<void> {
    await db('merchant_applications').where({ id }).update({
      shop_name: data.shop_name,
      reason: data.reason ?? null,
      status: 'pending',
      reviewer_id: null,
      reviewed_at: null,
      updated_at: db.fn.now(),
    });
  },
};
