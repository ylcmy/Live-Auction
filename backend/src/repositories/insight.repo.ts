import { db } from '../infrastructure/db/knex.js';

export const insightRepo = {
  /**
   * Counts total products for a merchant.
   */
  async getProductOverview(merchantId: number): Promise<{ total: number }> {
    const row = await db('products')
      .where({ merchant_id: merchantId })
      .count('* as total')
      .first();
    return { total: Number(row?.total ?? 0) };
  },

  /**
   * Groups products by status for a merchant.
   */
  async getProductStatusDistribution(
    merchantId: number,
  ): Promise<{ status: string; count: number }[]> {
    const rows = await db('products')
      .where({ merchant_id: merchantId })
      .select('status')
      .count('* as count')
      .groupBy('status');
    return rows.map((r: Record<string, unknown>) => ({
      status: r.status as string,
      count: Number(r.count ?? 0),
    }));
  },

  /**
   * Auction performance metrics for ended/unsold sessions.
   */
  async getAuctionPerformance(
    merchantId: number,
  ): Promise<{
    completed_count: number;
    sold_count: number;
    unsold_count: number;
    avg_premium_rate: number | null;
    avg_bid_count: number | null;
  }> {
    const row = await db('auction_sessions as s')
      .join('products as p', 'p.id', 's.product_id')
      .join('auction_rules as r', 'r.product_id', 'p.id')
      .where('p.merchant_id', merchantId)
      .whereIn('s.status', ['ended', 'unsold'])
      .select(
        db.raw('COUNT(*) as completed_count'),
        db.raw("SUM(CASE WHEN s.status = 'ended' AND s.winner_id IS NOT NULL THEN 1 ELSE 0 END) as sold_count"),
        db.raw("SUM(CASE WHEN s.status = 'unsold' THEN 1 ELSE 0 END) as unsold_count"),
        db.raw('AVG(s.current_price / NULLIF(r.start_price, 0)) as avg_premium_rate'),
        db.raw(`
          (SELECT AVG(bc.cnt) FROM (
            SELECT COUNT(*) as cnt FROM bid_records br
            JOIN auction_sessions s2 ON s2.id = br.session_id
            JOIN products p2 ON p2.id = s2.product_id
            WHERE p2.merchant_id = ? AND s2.status IN ('ended', 'unsold')
            GROUP BY br.session_id
          ) bc)
        `, [merchantId]) as unknown as string,
        )
      .first();

    return {
      completed_count: Number(row?.completed_count ?? 0),
      sold_count: Number(row?.sold_count ?? 0),
      unsold_count: Number(row?.unsold_count ?? 0),
      avg_premium_rate: row?.avg_premium_rate != null ? Number(row.avg_premium_rate) : null,
      avg_bid_count: row?.avg_bid_count != null ? Number(row.avg_bid_count) : null,
    };
  },

  /**
   * Hourly bid distribution, top 3 peak hours, and unique/repeat bidder counts.
   */
  async getBiddingHeat(
    merchantId: number,
  ): Promise<{
    hourly_distribution: { hour: number; bid_count: number }[];
    top_3_hours: { hour: number; bid_count: number }[];
    unique_bidders: number;
    repeat_bidders: number;
  }> {
    // Hourly distribution
    const hourlyRows = await db('bid_records as br')
      .join('auction_sessions as s', 's.id', 'br.session_id')
      .join('products as p', 'p.id', 's.product_id')
      .where('p.merchant_id', merchantId)
      .select(db.raw('HOUR(br.created_at) as hour'))
      .count('* as bid_count')
      .groupBy(db.raw('HOUR(br.created_at)'))
      .orderBy('bid_count', 'desc');

    const hourly_distribution = hourlyRows.map((r: Record<string, unknown>) => ({
      hour: Number(r.hour),
      bid_count: Number(r.bid_count ?? 0),
    }));

    const top_3_hours = hourly_distribution.slice(0, 3);

    // Unique and repeat bidders
    const bidderRow = await db('bid_records as br')
      .join('auction_sessions as s', 's.id', 'br.session_id')
      .join('products as p', 'p.id', 's.product_id')
      .where('p.merchant_id', merchantId)
      .select(
        db.raw('COUNT(DISTINCT br.user_id) as unique_bidders'),
        db.raw(`
          COUNT(DISTINCT CASE WHEN (
            SELECT COUNT(*) FROM bid_records br2
            WHERE br2.user_id = br.user_id
            AND br2.session_id IN (
              SELECT s3.id FROM auction_sessions s3
              JOIN products p3 ON p3.id = s3.product_id
              WHERE p3.merchant_id = ?
            )
          ) > 1 THEN br.user_id END) as repeat_bidders
        `, [merchantId]) as unknown as string,
        )
      .first();

    return {
      hourly_distribution,
      top_3_hours,
      unique_bidders: Number(bidderRow?.unique_bidders ?? 0),
      repeat_bidders: Number(bidderRow?.repeat_bidders ?? 0),
    };
  },

  /**
   * Daily revenue for the given number of days.
   */
  async getDailyRevenue(
    merchantId: number,
    days: number,
  ): Promise<{ date: string; amount: number }[]> {
    const rows = await db('orders as o')
      .join('products as p', 'p.id', 'o.product_id')
      .where('p.merchant_id', merchantId)
      .whereIn('o.status', ['paid', 'completed'])
      .where('o.created_at', '>=', db.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
      .select(db.raw('DATE(o.created_at) as date'))
      .sum('o.final_price as amount')
      .groupBy(db.raw('DATE(o.created_at)'))
      .orderBy('date', 'asc');

    return rows.map((r: Record<string, unknown>) => ({
      date: r.date as string,
      amount: Number(r.amount ?? 0),
    }));
  },

  /**
   * Overall revenue stats for a merchant.
   */
  async getRevenueOverview(
    merchantId: number,
  ): Promise<{ total_orders: number; total_revenue: number; paid_orders: number }> {
    const row = await db('orders as o')
      .join('products as p', 'p.id', 'o.product_id')
      .where('p.merchant_id', merchantId)
      .select(
        db.raw('COUNT(*) as total_orders'),
        db.raw('SUM(o.final_price) as total_revenue'),
        db.raw("SUM(CASE WHEN o.status IN ('paid', 'completed') THEN 1 ELSE 0 END) as paid_orders"),
      )
      .first();

    return {
      total_orders: Number(row?.total_orders ?? 0),
      total_revenue: Number(row?.total_revenue ?? 0),
      paid_orders: Number(row?.paid_orders ?? 0),
    };
  },

  /**
   * Top products by revenue.
   */
  async getTopProducts(
    merchantId: number,
    limit: number,
  ): Promise<{ name: string; revenue: number }[]> {
    const rows = await db('orders as o')
      .join('products as p', 'p.id', 'o.product_id')
      .where('p.merchant_id', merchantId)
      .whereIn('o.status', ['paid', 'completed'])
      .select('p.name')
      .sum('o.final_price as revenue')
      .groupBy('p.id', 'p.name')
      .orderBy('revenue', 'desc')
      .limit(limit);

    return rows.map((r: Record<string, unknown>) => ({
      name: r.name as string,
      revenue: Number(r.revenue ?? 0),
    }));
  },

  /**
   * Ratio of ended auctions that have a corresponding order.
   */
  async getConversionRate(
    merchantId: number,
  ): Promise<{ total_ended: number; with_order: number }> {
    const row = await db('auction_sessions as s')
      .join('products as p', 'p.id', 's.product_id')
      .leftJoin('orders as o', 'o.session_id', 's.id')
      .where('p.merchant_id', merchantId)
      .whereIn('s.status', ['ended', 'unsold'])
      .select(
        db.raw('COUNT(*) as total_ended'),
        db.raw('COUNT(o.id) as with_order'),
      )
      .first();

    return {
      total_ended: Number(row?.total_ended ?? 0),
      with_order: Number(row?.with_order ?? 0),
    };
  },
};
