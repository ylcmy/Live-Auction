/**
 * Pagination utility for Knex query builders.
 *
 * Clones the query to get total count (without mutating the original),
 * then applies offset/limit and returns paginated results.
 */

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Apply pagination to a Knex query builder.
 *
 * @param queryBuilder - A Knex query builder (already filtered/ordered)
 * @param page - 1-based page number
 * @param limit - Number of items per page
 * @returns Paginated result with items, total count, page, and limit
 */
export async function paginateQuery<T = unknown>(
  queryBuilder: any,
  page: number,
  limit: number,
): Promise<PaginatedResult<T>> {
  // Clone to get count without mutating the original query
  const countResult = await queryBuilder
    .clone()
    .count()
    .first();

  const total = countResult?.count ?? 0;

  const offset = (page - 1) * limit;
  const items = await queryBuilder
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(limit);

  return {
    items,
    total: Number(total),
    page,
    limit,
  };
}
