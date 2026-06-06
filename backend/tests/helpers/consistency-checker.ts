import { db } from '../../src/infrastructure/db/knex.js';
import { cache } from '../../src/infrastructure/cache/redis.js';

export interface ConsistencyReport {
  sessionId: number;
  dbTopAmount: number;
  redisTopAmount: number;
  dbBidCount: number;
  redisRankCount: number;
  idempotencyViolations: number;
  passed: boolean;
}

function leaderboardKey(sessionId: number): string {
  return `auction:${sessionId}:leaderboard`;
}

export async function checkAuctionConsistency(
  sessionId: number,
): Promise<ConsistencyReport> {
  const dbTopRow = await db('bid_records')
    .where({ session_id: sessionId })
    .max('bid_amount as maxAmount')
    .first();
  const dbTopAmount = Number(dbTopRow?.maxAmount ?? 0);

  const dbBidCountRow = await db('bid_records')
    .where({ session_id: sessionId })
    .count('* as cnt')
    .first();
  const dbBidCount = Number(dbBidCountRow?.cnt ?? 0);

  const dupRows = await db('bid_records')
    .where({ session_id: sessionId })
    .select('idempotency_key')
    .groupBy('idempotency_key')
    .havingRaw('COUNT(*) > 1');
  const idempotencyViolations = dupRows.length;

  const lbKey = leaderboardKey(sessionId);
  const redisRankCount = await cache.zcard(lbKey);
  const topPair = await cache.zrevrange(lbKey, 0, 0);
  const redisTopAmount =
    topPair.length >= 2 ? Number(topPair[1]) : dbBidCount === 0 ? 0 : dbTopAmount;

  const passed =
    idempotencyViolations === 0 &&
    (dbBidCount === 0
      ? redisRankCount === 0
      : dbTopAmount === redisTopAmount && redisRankCount > 0);

  return {
    sessionId,
    dbTopAmount,
    redisTopAmount,
    dbBidCount,
    redisRankCount,
    idempotencyViolations,
    passed,
  };
}

export async function assertAuctionConsistency(sessionId: number): Promise<void> {
  const report = await checkAuctionConsistency(sessionId);
  if (!report.passed) {
    throw new Error(
      `Auction consistency failed for session ${sessionId}: ${JSON.stringify(report)}`,
    );
  }
}
