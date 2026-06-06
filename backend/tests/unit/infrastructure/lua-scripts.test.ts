import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import {
  BID_CAS_SCRIPT,
  BID_ROLLBACK_SCRIPT,
} from '../../../src/infrastructure/cache/lua-scripts.js';

describe('Lua scripts (real Redis)', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({
      host: '127.0.0.1',
      port: 6379,
      password: process.env.REDIS_PASSWORD || '123321',
      db: 15,
    });
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  const TOP_BID_KEY = 'test:auction:1:top_bid';
  const LB_KEY = 'test:auction:1:leaderboard';
  const PARTICIPANTS_KEY = 'test:auction:1:participants';

  function casKeys(): string[] {
    return [TOP_BID_KEY, LB_KEY, PARTICIPANTS_KEY];
  }

  function rollbackKeys(): string[] {
    return [LB_KEY, PARTICIPANTS_KEY, TOP_BID_KEY];
  }

  // ── BID_CAS_SCRIPT ────────────────────────────────────────────────────────

  describe('BID_CAS_SCRIPT', () => {
    beforeEach(async () => {
      await redis.flushdb();
    });

    afterEach(async () => {
      await redis.flushdb();
    });

    it('returns 1 when no existing bid (first bid)', async () => {
      const bidData = JSON.stringify({ userId: 'u1', amount: 100 });
      const result = await redis.eval(
        BID_CAS_SCRIPT,
        3,
        ...casKeys(),
        'u1',
        '100',
        bidData,
        '0',
      );
      expect(result).toBe(1);
    });

    it('returns 1 when new bid is strictly higher than current', async () => {
      const first = JSON.stringify({ userId: 'u1', amount: 100 });
      await redis.eval(BID_CAS_SCRIPT, 3, ...casKeys(), 'u1', '100', first, '0');

      const second = JSON.stringify({ userId: 'u2', amount: 200 });
      const result = await redis.eval(
        BID_CAS_SCRIPT,
        3,
        ...casKeys(),
        'u2',
        '200',
        second,
        '0',
      );
      expect(result).toBe(1);
    });

    it('returns 0 when new bid equals current bid', async () => {
      const first = JSON.stringify({ userId: 'u1', amount: 100 });
      await redis.eval(BID_CAS_SCRIPT, 3, ...casKeys(), 'u1', '100', first, '0');

      const duplicate = JSON.stringify({ userId: 'u2', amount: 100 });
      const result = await redis.eval(
        BID_CAS_SCRIPT,
        3,
        ...casKeys(),
        'u2',
        '100',
        duplicate,
        '0',
      );
      expect(result).toBe(0);
    });

    it('returns 0 when new bid is lower than current', async () => {
      const first = JSON.stringify({ userId: 'u1', amount: 200 });
      await redis.eval(BID_CAS_SCRIPT, 3, ...casKeys(), 'u1', '200', first, '0');

      const lower = JSON.stringify({ userId: 'u2', amount: 150 });
      const result = await redis.eval(
        BID_CAS_SCRIPT,
        3,
        ...casKeys(),
        'u2',
        '150',
        lower,
        '0',
      );
      expect(result).toBe(0);
    });

    it('truncates bid to ceiling price when bid exceeds ceiling', async () => {
      // ceiling = 500, bid = 800 -> truncated to 500
      const bidData = JSON.stringify({ userId: 'u1', amount: 800 });
      const result = await redis.eval(
        BID_CAS_SCRIPT,
        3,
        ...casKeys(),
        'u1',
        '800',
        bidData,
        '500',
      );
      expect(result).toBe(1);

      // Verify stored amount is 500 (ceiling), not 800
      const stored = await redis.get(TOP_BID_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.amount).toBe(500);
    });

    it('returns 0 when ceiling-truncated bid is still below current', async () => {
      // Current bid = 600, ceiling = 500 -> truncated 500 <= 600 -> fail
      const first = JSON.stringify({ userId: 'u1', amount: 600 });
      await redis.eval(BID_CAS_SCRIPT, 3, ...casKeys(), 'u1', '600', first, '0');

      const result = await redis.eval(
        BID_CAS_SCRIPT,
        3,
        ...casKeys(),
        'u2',
        '800',
        JSON.stringify({ userId: 'u2', amount: 800 }),
        '500',
      );
      expect(result).toBe(0);
    });

    it('adds user to participants set on success', async () => {
      const bidData = JSON.stringify({ userId: 'u7', amount: 300 });
      await redis.eval(BID_CAS_SCRIPT, 3, ...casKeys(), 'u7', '300', bidData, '0');

      const members = await redis.smembers(PARTICIPANTS_KEY);
      expect(members).toContain('u7');
    });
  });

  // ── BID_ROLLBACK_SCRIPT (fixed version) ───────────────────────────────────

  describe('BID_ROLLBACK_SCRIPT', () => {
    beforeEach(async () => {
      await redis.flushdb();
    });

    afterEach(async () => {
      await redis.flushdb();
    });

    it('recalculates top_bid from leaderboard after rollback (multi-user)', async () => {
      // Set up leaderboard with two users
      await redis.zadd(LB_KEY, 100, 'u1', 200, 'u2');
      await redis.sadd(PARTICIPANTS_KEY, 'u1', 'u2');
      await redis.set(
        TOP_BID_KEY,
        JSON.stringify({ userId: 'u2', amount: 200 }),
      );

      // Rollback u2
      await redis.eval(
        BID_ROLLBACK_SCRIPT,
        3,
        ...rollbackKeys(),
        'u2',
        '',
      );

      // top_bid should be recalculated from leaderboard -> u1 @ 100
      const stored = await redis.get(TOP_BID_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.userId).toBe('u1');
      expect(parsed.amount).toBe(100);

      // u2 removed from leaderboard and participants
      const lbMembers = await redis.zrange(LB_KEY, 0, -1);
      expect(lbMembers).not.toContain('u2');
      const participants = await redis.smembers(PARTICIPANTS_KEY);
      expect(participants).not.toContain('u2');
    });

    it('falls back to prevTopBidData when leaderboard is empty', async () => {
      // Leaderboard has only one user who is being rolled back
      await redis.zadd(LB_KEY, 100, 'u1');
      await redis.sadd(PARTICIPANTS_KEY, 'u1');
      await redis.set(
        TOP_BID_KEY,
        JSON.stringify({ userId: 'u1', amount: 100 }),
      );

      const prevTopBidData = JSON.stringify({
        userId: 'u0',
        amount: 0,
      });
      await redis.eval(
        BID_ROLLBACK_SCRIPT,
        3,
        ...rollbackKeys(),
        'u1',
        prevTopBidData,
      );

      const stored = await redis.get(TOP_BID_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.userId).toBe('u0');
      expect(parsed.amount).toBe(0);
    });
  });
});
