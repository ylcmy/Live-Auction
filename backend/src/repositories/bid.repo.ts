import { db } from '../infrastructure/db/knex.js';

export interface BidRecord {
  id: number;
  session_id: number;
  user_id: number;
  bid_amount: number;
  idempotency_key: string;
  created_at: string;
}

export interface LeaderboardRow {
  rank: number;
  userId: number;
  userNickname: string;
  avatarUrl: string | null;
  amount: number;
  timestamp: string;
}

export const bidRepo = {
  async create(data: {
    session_id: number;
    user_id: number;
    bid_amount: number;
    idempotency_key: string;
  }, trx?: any): Promise<number> {
    const query = trx || db;
    const [id] = await query('bid_records').insert(data);
    return id as number;
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

  /**
   * MySQL fallback leaderboard query.
   * Returns top bids for a session with user profile info.
   */
  async findLeaderboard(
    sessionId: number,
    limit = 20,
  ): Promise<LeaderboardRow[]> {
    const rows = await db('bid_records')
      .leftJoin('users', 'bid_records.user_id', 'users.id')
      .where('bid_records.session_id', sessionId)
      .select(
        'bid_records.user_id',
        'bid_records.bid_amount',
        'bid_records.created_at',
        'users.nickname as userNickname',
        'users.avatar_url as avatarUrl',
      )
      .orderBy('bid_records.bid_amount', 'desc')
      .orderBy('bid_records.created_at', 'asc')
      .limit(limit);

    return rows.map((row: any, index: number) => ({
      rank: index + 1,
      userId: row.user_id,
      userNickname: row.userNickname || `用户${row.user_id}`,
      avatarUrl: row.avatarUrl || null,
      amount: Number(row.bid_amount),
      timestamp: row.created_at,
    }));
  },
};
