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

export interface PaginateOptions {
  /** Optional ordering: [column, direction] e.g. ['created_at', 'desc'] */
  orderBy?: [string, 'asc' | 'desc'];
  /** Optional separate query builder for counting (useful when rows query has joins that affect count) */
  countQueryBuilder?: any;
}

/**
 * Apply pagination to a Knex query builder.
 *
 * @param queryBuilder - A Knex query builder (already filtered/ordered)
 * @param page - 1-based page number
 * @param limit - Number of items per page
 * @param options - Optional: orderBy tuple and/or separate countQueryBuilder
 * @returns Paginated result with items, total count, page, and limit
 */
export async function paginateQuery<T = unknown>(
  queryBuilder: any,
  page: number,
  limit: number,
  options?: PaginateOptions,
): Promise<PaginatedResult<T>> {
  // Use separate count query if provided, otherwise clone the main query
  const countQb = options?.countQueryBuilder ?? queryBuilder.clone();
  const countResult = await countQb.clearSelect().count('* as total').first();

  const total = countResult?.total ?? 0;

  const offset = (page - 1) * limit;
  let itemsQuery = queryBuilder.offset(offset).limit(limit);
  if (options?.orderBy) {
    itemsQuery = itemsQuery.orderBy(options.orderBy[0], options.orderBy[1]);
  }

  const items = await itemsQuery;

  return {
    items,
    total: Number(total),
    page,
    limit,
  };
}
