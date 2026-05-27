import { db } from '../infrastructure/db/knex.js';

export const auctionRuleRepo = {
  async create(data: {
    product_id: number;
    start_price: number;
    bid_increment: number;
    ceiling_price?: number | null;
    duration_seconds: number;
    extend_seconds: number;
    max_extensions?: number;
  }): Promise<number> {
    const [id] = await db('auction_rules').insert({
      ...data,
      max_extensions: data.max_extensions ?? 10,
    });
    return id;
  },

  async findByProductId(productId: number) {
    return db('auction_rules').where({ product_id: productId }).first();
  },

  async update(
    productId: number,
    data: {
      bid_increment?: number;
      ceiling_price?: number | null;
      duration_seconds?: number;
      extend_seconds?: number;
      max_extensions?: number;
    },
  ) {
    return db('auction_rules')
      .where({ product_id: productId })
      .update({ ...data, updated_at: db.fn.now() });
  },
};
