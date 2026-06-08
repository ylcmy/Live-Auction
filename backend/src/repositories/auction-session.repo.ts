import { db } from '../infrastructure/db/knex.js';
import { paginateQuery } from '../lib/paginate.js';

const ACTIVE_STATUSES = ['pending', 'active'];

export const auctionSessionRepo = {
  async create(data: { product_id: number; rule_id: number; room_id: number; current_price?: number }) {
    const [id] = await db('auction_sessions').insert({
      ...data,
      status: 'active',
      active_room_id: data.room_id,
      current_price: data.current_price ?? 0.00,
      started_at: db.fn.now(),
    });
    return id as number;
  },
  async findById(id: number) {
    return db('auction_sessions').where({ id }).first();
  },
  /**
   * Find session by ID using SELECT FOR UPDATE within a transaction.
   * Acquires a row-level lock for MySQL fallback path.
   */
  async findByIdForUpdate(id: number, trx: any) {
    return trx('auction_sessions').where({ id }).forUpdate().first();
  },
  async findActiveByRoom(roomId: number) {
    return db('auction_sessions').where({ active_room_id: roomId }).first();
  },
  /**
   * Find active session using SELECT FOR UPDATE within a transaction.
   * This acquires a row-level lock preventing concurrent inserts for the same room.
   */
  async findActiveByRoomForUpdate(roomId: number, trx: any) {
    return trx('auction_sessions')
      .where({ active_room_id: roomId })
      .forUpdate()
      .first();
  },
  async updateStatus(id: number, status: string, extra: Record<string, any> = {}) {
    const update: Record<string, any> = { status, ...extra, updated_at: db.fn.now() };

    // When transitioning away from active/pending, clear active_room_id
    if (!ACTIVE_STATUSES.includes(status)) {
      update.active_room_id = null;
    }

    return db('auction_sessions').where({ id }).update(update);
  },
  async updatePrice(id: number, price: number, winnerId?: number) {
    const update: any = { current_price: price, updated_at: db.fn.now() };
    if (winnerId) update.winner_id = winnerId;
    return db('auction_sessions').where({ id }).update(update).increment('version', 1);
  },
  async findAllActive(): Promise<Array<{ id: number; started_at: Date | string; rule_id: number; extension_count: number }>> {
    return db('auction_sessions')
      .where({ status: 'active' })
      .select('id', 'started_at', 'rule_id', 'extension_count');
  },
  async findAll(filters: { room_id?: number; status?: string; page?: number; limit?: number } = {}) {
    const { room_id, status, page = 1, limit = 20 } = filters;
    let query = db('auction_sessions');
    if (room_id) query = query.where({ room_id });
    if (status) query = query.where({ status });
    return paginateQuery(query, page, limit, { orderBy: ['created_at', 'desc'] });
  },
};
