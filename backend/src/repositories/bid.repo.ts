import { db } from '../infrastructure/db/knex.js';

export interface BidRecord {
  id: number;
  session_id: number;
  user_id: number;
  bid_amount: number;
  idempotency_key: string;
  created_at: string;
}

export const bidRepo = {
  async create(data: {
    session_id: number;
    user_id: number;
    bid_amount: number;
    idempotency_key: string;
  }): Promise<number> {
    const [id] = await db('bid_records').insert(data);
    return id;
  },

  async findBySession(
    sessionId: number,
    limit = 50,
  ): Promise<BidRecord[]> {
    return db('bid_records')
      .where({ session_id: sessionId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  },
};
