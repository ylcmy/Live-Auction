import { vi } from 'vitest';

/**
 * Creates a mock cache object that simulates the Redis cache interface
 * defined in backend/src/infrastructure/cache/redis.ts.
 *
 * Uses in-memory Maps to store data, with vi.fn() wrappers for call tracking.
 */
export function createMockCache() {
  const store = new Map<string, string>();
  const sortedSets = new Map<string, Map<string, number>>();
  const sets = new Map<string, Set<string>>();

  return {
    // ---- String operations ----
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ttl?: number) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      const existed = store.has(key) ? 1 : 0;
      store.delete(key);
      return existed;
    }),
    setnx: vi.fn(async (key: string, value: string, ttl?: number) => {
      if (store.has(key)) return 0;
      store.set(key, value);
      return 1;
    }),

    // ---- Sorted set operations ----
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!sortedSets.has(key)) sortedSets.set(key, new Map());
      sortedSets.get(key)!.set(member, score);
      return 1;
    }),
    zrevrange: vi.fn(async (key: string, start: number, stop: number) => {
      const set = sortedSets.get(key);
      if (!set) return [];
      const sorted = [...set.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(start, stop + 1);
      // ioredis WITHSCORES returns flat array: [member, score, member, score, ...]
      return sorted.flatMap(([member, score]) => [member, String(score)]);
    }),
    zrank: vi.fn(async (key: string, member: string) => {
      const set = sortedSets.get(key);
      if (!set) return null;
      const sorted = [...set.entries()].sort((a, b) => a[1] - b[1]);
      const idx = sorted.findIndex(([m]) => m === member);
      return idx >= 0 ? idx : null;
    }),
    zrevrank: vi.fn(async (key: string, member: string) => {
      const set = sortedSets.get(key);
      if (!set) return null;
      const sorted = [...set.entries()].sort((a, b) => b[1] - a[1]);
      const idx = sorted.findIndex(([m]) => m === member);
      return idx >= 0 ? idx : null;
    }),
    zscore: vi.fn(async (key: string, member: string) => {
      const set = sortedSets.get(key);
      return set?.get(member)?.toString() ?? null;
    }),
    zcard: vi.fn(async (key: string) => sortedSets.get(key)?.size ?? 0),

    // ---- Set operations ----
    sadd: vi.fn(async (key: string, ...members: string[]) => {
      if (!sets.has(key)) sets.set(key, new Set());
      const set = sets.get(key)!;
      let added = 0;
      for (const member of members) {
        if (!set.has(member)) {
          set.add(member);
          added++;
        }
      }
      return added;
    }),
    srem: vi.fn(async (key: string, ...members: string[]) => {
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const member of members) {
        if (set.delete(member)) removed++;
      }
      return removed;
    }),
    scard: vi.fn(async (key: string) => sets.get(key)?.size ?? 0),

    // ---- Key expiration ----
    expire: vi.fn(async (_key: string, _seconds: number) => 1),

    // ---- Test helpers ----
    _store: store,
    _sortedSets: sortedSets,
    _sets: sets,
    _reset: () => {
      store.clear();
      sortedSets.clear();
      sets.clear();
    },
  };
}

export type MockCache = ReturnType<typeof createMockCache>;
