/**
 * US1: Docker test env schema + Redis baseline after prepare.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../src/infrastructure/db/knex.js';
import { getDbKeyCount } from '../helpers/redis-test-utils.js';
import { prepareTestEnvironment } from '../../scripts/lib/prepare-test-env.js';

describe('test environment schema (US1)', () => {
  beforeAll(async () => {
    await prepareTestEnvironment({ skipDocker: process.env.SKIP_DOCKER_PREPARE === '1' });
  });

  it('auction_sessions has migration 016 columns', async () => {
    const schema = process.env.DB_NAME || 'live_auction_test';
    const columns = await db('information_schema.columns')
      .where({ table_schema: schema, table_name: 'auction_sessions' })
      .pluck('COLUMN_NAME');
    const names = columns.map((c: string) => c.toLowerCase());

    for (const col of [
      'active_room_id',
      'rule_id',
      'version',
      'extension_count',
    ]) {
      expect(names, `missing column ${col}`).toContain(col);
    }
  });

  it('Redis is empty after FLUSHALL (DBSIZE 0)', async () => {
    expect(await getDbKeyCount()).toBe(0);
  });
});

describe('test env prepare duration (SC-011)', () => {
  it('completes within 120s', async () => {
    const result = await prepareTestEnvironment({
      skipDocker: process.env.SKIP_DOCKER_PREPARE === '1',
      assertMaxDurationMs: 120_000,
    });
    expect(result.durationMs).toBeLessThan(120_000);
  });
});
