import { db } from '../infrastructure/db/knex.js';

export const productRepo = {
  async create(data: {
    merchant_id: number;
    name: string;
    description?: string;
    image_url?: string;
    category?: string;
  }): Promise<number> {
    const [id] = await db('products').insert({ ...data, status: 'pending' });
    return id as number;
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

    let countQuery = db('products');
    if (merchant_id) countQuery = countQuery.where({ merchant_id });
    if (status) {
      countQuery = countQuery.where({ status });
    } else {
      countQuery = countQuery.whereNot({ status: 'deleted' });
    }
    const total = await countQuery.count('* as count').first();

    let rowsQuery = db('products')
      .leftJoin('auction_rules', 'products.id', 'auction_rules.product_id')
      .select(
        'products.*',
        'auction_rules.id as rule_id',
        'auction_rules.start_price as rule_startPrice',
        'auction_rules.bid_increment as rule_bidIncrement',
        'auction_rules.ceiling_price as rule_ceilingPrice',
        'auction_rules.duration_seconds as rule_durationSeconds',
        'auction_rules.extend_seconds as rule_extendSeconds',
        'auction_rules.max_extensions as rule_maxExtensions',
      );

    if (merchant_id) rowsQuery = rowsQuery.where({ 'products.merchant_id': merchant_id });
    if (status) {
      rowsQuery = rowsQuery.where({ 'products.status': status });
    } else {
      rowsQuery = rowsQuery.whereNot({ 'products.status': 'deleted' });
    }

    const rows = await rowsQuery
      .orderBy('products.created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    const items = rows.map((row: any) => {
      const product = { ...row };
      if (row.rule_id) {
        product.rule = {
          id: row.rule_id,
          productId: row.id,
          startPrice: Number(row.rule_startPrice ?? 0),
          bidIncrement: Number(row.rule_bidIncrement ?? 0),
          ceilingPrice: row.rule_ceilingPrice != null ? Number(row.rule_ceilingPrice) : null,
          durationSeconds: row.rule_durationSeconds ?? 0,
          extendSeconds: row.rule_extendSeconds ?? 0,
          maxExtensions: row.rule_maxExtensions ?? 10,
        };
      }
      delete product.rule_id;
      delete product.rule_startPrice;
      delete product.rule_bidIncrement;
      delete product.rule_ceilingPrice;
      delete product.rule_durationSeconds;
      delete product.rule_extendSeconds;
      delete product.rule_maxExtensions;
      return product;
    });

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
