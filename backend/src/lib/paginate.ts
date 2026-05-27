import { Knex } from 'knex';

export async function paginateQuery<T>(
  query: Knex.QueryBuilder,
  page: number,
  limit: number,
): Promise<{ items: T[]; total: number; page: number; limit: number }> {
  const total = await query.clone().count('* as count').first();
  const items = await query
    .orderBy('created_at', 'desc')
    .offset((page - 1) * limit)
    .limit(limit);
  return { items: items as T[], total: Number((total as any)?.count || 0), page, limit };
}
