import { describe, it, expect, vi } from 'vitest';
import { paginateQuery } from '../../../src/lib/paginate.js';

function createMockQueryBuilder(totalCount: number, items: unknown[]) {
  const cloneChain = {
    clearSelect: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({ total: totalCount }),
  };

  const mainChain = {
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(items),
  };

  return {
    clone: vi.fn().mockReturnValue(cloneChain),
    ...mainChain,
  };
}

describe('paginateQuery', () => {
  it('should return paginated results for page=1, limit=10', async () => {
    // Arrange
    const items = [{ id: 1 }, { id: 2 }];
    const qb = createMockQueryBuilder(25, items);

    // Act
    const result = await paginateQuery(qb as any, 1, 10);

    // Assert
    expect(result.items).toEqual(items);
    expect(result.total).toBe(25);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(qb.offset).toHaveBeenCalledWith(0);
    expect(qb.limit).toHaveBeenCalledWith(10);
  });

  it('should calculate correct offset for page=3, limit=10', async () => {
    // Arrange
    const items = [{ id: 21 }, { id: 22 }];
    const qb = createMockQueryBuilder(30, items);

    // Act
    const result = await paginateQuery(qb as any, 3, 10);

    // Assert
    expect(result.page).toBe(3);
    expect(qb.offset).toHaveBeenCalledWith(20);
    expect(qb.limit).toHaveBeenCalledWith(10);
  });

  it('should handle page=0 (boundary)', async () => {
    // Arrange
    const items: unknown[] = [];
    const qb = createMockQueryBuilder(0, items);

    // Act
    const result = await paginateQuery(qb as any, 0, 10);

    // Assert
    expect(result.page).toBe(0);
    // offset = (0 - 1) * 10 = -10
    expect(qb.offset).toHaveBeenCalledWith(-10);
    expect(result.items).toEqual([]);
  });

  it('should handle limit=0 (boundary)', async () => {
    // Arrange
    const items: unknown[] = [];
    const qb = createMockQueryBuilder(5, items);

    // Act
    const result = await paginateQuery(qb as any, 1, 0);

    // Assert
    expect(result.limit).toBe(0);
    expect(qb.limit).toHaveBeenCalledWith(0);
    expect(result.items).toEqual([]);
  });

  it('should handle negative page values', async () => {
    // Arrange
    const items: unknown[] = [];
    const qb = createMockQueryBuilder(0, items);

    // Act
    const result = await paginateQuery(qb as any, -1, 10);

    // Assert
    expect(result.page).toBe(-1);
    // offset = (-1 - 1) * 10 = -20
    expect(qb.offset).toHaveBeenCalledWith(-20);
  });

  it('should handle negative limit values', async () => {
    // Arrange
    const items: unknown[] = [];
    const qb = createMockQueryBuilder(0, items);

    // Act
    const result = await paginateQuery(qb as any, 1, -5);

    // Assert
    expect(result.limit).toBe(-5);
    expect(qb.limit).toHaveBeenCalledWith(-5);
  });

  it('should return total=0 when count query returns null', async () => {
    // Arrange
    const cloneChain = {
      clearSelect: vi.fn().mockReturnThis(),
      count: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    };
    const qb = {
      clone: vi.fn().mockReturnValue(cloneChain),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    // Act
    const result = await paginateQuery(qb as any, 1, 10);

    // Assert
    expect(result.total).toBe(0);
  });

  it('should call clone() before count to avoid mutating the original query', async () => {
    // Arrange
    const qb = createMockQueryBuilder(0, []);

    // Act
    await paginateQuery(qb as any, 1, 10);

    // Assert
    expect(qb.clone).toHaveBeenCalledTimes(1);
  });
});
