import { checkAuctionConsistency } from '../tests/helpers/consistency-checker.js';

const arg = process.argv.find((a) => a.startsWith('--session-id='));
if (!arg) {
  console.error('Usage: npx tsx backend/scripts/check-consistency.ts --session-id=<N>');
  process.exit(1);
}

const sessionId = Number(arg.split('=')[1]);
if (!Number.isFinite(sessionId) || sessionId <= 0) {
  console.error(`Invalid session-id: ${arg.split('=')[1]}`);
  process.exit(1);
}

const report = await checkAuctionConsistency(sessionId);

const topMatch =
  report.dbBidCount === 0
    ? 'No bids in DB.'
    : `DB top amount (${report.dbTopAmount}) ${report.dbTopAmount === report.redisTopAmount ? 'matches' : 'does NOT match'} Redis top amount (${report.redisTopAmount}).`;

const output = {
  timestamp: new Date().toISOString(),
  session_id: report.sessionId,
  consistency: {
    db_top_amount: report.dbTopAmount,
    redis_top_amount: report.redisTopAmount,
    db_bid_count: report.dbBidCount,
    redis_rank_count: report.redisRankCount,
    idempotency_violations: report.idempotencyViolations,
    passed: report.passed,
  },
  details: `${topMatch} Bid count: DB=${report.dbBidCount}, Redis=${report.redisRankCount}. Idempotency violations: ${report.idempotencyViolations}.`,
};

console.log(JSON.stringify(output, null, 2));
process.exit(report.passed ? 0 : 1);
