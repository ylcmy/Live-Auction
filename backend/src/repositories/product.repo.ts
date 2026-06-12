import { db } from '../infrastructure/db/knex.js';
import { paginateQuery } from '../lib/paginate.js';

/**
 * Trim sensitive merchant rule fields from a product row for non-owner views.
 * Returns only publicly safe fields.
 */
export function toPublicProductView(product: Record<string, any>): Record<string, any> {
  const { start_price, bid_increment, ceiling_price, duration, merchant_id, rule, ...publicFields } = product;
  // Also strip nested rule object if present
  if (publicFields.rule) {
    delete publicFields.rule;
  }
  return publicFields;
}

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

    // Count query without joins for efficiency
    let countQuery = db('products');
    if (merchant_id) countQuery = countQuery.where({ merchant_id });
    if (status) {
      countQuery = countQuery.where({ status });
    } else {
      countQuery = countQuery.whereNot({ status: 'deleted' });
    }

    // Rows query with joins for full data
    let rowsQuery = db('products')
      .leftJoin('auction_rules', 'products.id', 'auction_rules.product_id')
      .leftJoin('auction_sessions as s', function () {
        this.on('s.product_id', 'products.id').andOnVal('s.status', 'active');
      })
      .leftJoin(
        db('bid_records')
          .select('session_id', db.raw('COUNT(*) as bid_count'))
          .groupBy('session_id')
          .as('br'),
        'br.session_id',
        's.id',
      )
      .select(
        'products.*',
        'auction_rules.id as rule_id',
        'auction_rules.start_price as rule_startPrice',
        'auction_rules.bid_increment as rule_bidIncrement',
        'auction_rules.ceiling_price as rule_ceilingPrice',
        'auction_rules.duration_seconds as rule_durationSeconds',
        'auction_rules.extend_seconds as rule_extendSeconds',
        'auction_rules.max_extensions as rule_maxExtensions',
        's.id as session_id',
        's.current_price as session_currentPrice',
        's.started_at as session_startedAt',
        db.raw('COALESCE(br.bid_count, 0) as bidCount'),
      );

    if (merchant_id) rowsQuery = rowsQuery.where({ 'products.merchant_id': merchant_id });
    if (status) {
      rowsQuery = rowsQuery.where({ 'products.status': status });
    } else {
      rowsQuery = rowsQuery.whereNot({ 'products.status': 'deleted' });
    }

    const result = await paginateQuery(rowsQuery, page, limit, {
      orderBy: ['products.created_at', 'desc'],
      countQueryBuilder: countQuery,
    });

    const items = result.items.map((row: any) => {
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
      product.currentPrice = row.session_currentPrice != null ? Number(row.session_currentPrice) : null;
      product.bidCount = Number(row.bidCount ?? 0);
      product.sessionId = row.session_id ?? null;
      product.startedAt = row.session_startedAt ?? null;
      delete product.rule_id;
      delete product.rule_startPrice;
      delete product.rule_bidIncrement;
      delete product.rule_ceilingPrice;
      delete product.rule_durationSeconds;
      delete product.rule_extendSeconds;
      delete product.rule_maxExtensions;
      delete product.session_currentPrice;
      delete product.session_id;
      delete product.session_startedAt;
      return product;
    });

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  },

  async updateStatus(id: number, status: string) {
    return db('products').where({ id }).update({ status, updated_at: db.fn.now() });
  },
};
