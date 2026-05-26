/**
 * T064: BidRecord Repository
 *
 * Data access layer for bid_records table (MySQL).
 * Write operations are async — called from bid.service.ts after Redis confirms the bid.
 */

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
  /**
   * Create a new bid record in MySQL.
   * Returns the auto-generated id.
   */
  async create(data: {
    session_id: number;
    user_id: number;
    bid_amount: number;
    idempotency_key: string;
  }): Promise<number> {
    const [id] = await db('bid_records').insert(data);
    return id;
  },

  /**
   * Find bid records for a session, ordered by most recent first.
   */
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
   * Find bid records for a specific user in a session.
   */
  async findByUserAndSession(
    userId: number,
    sessionId: number,
    limit = 1,
  ): Promise<BidRecord[]> {
    return db('bid_records')
      .where({ user_id: userId, session_id: sessionId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  },

  /**
   * Check if an idempotency key has already been used.
   */
  async findByIdempotencyKey(key: string): Promise<BidRecord | undefined> {
    return db('bid_records').where({ idempotency_key: key }).first();
  },
};
