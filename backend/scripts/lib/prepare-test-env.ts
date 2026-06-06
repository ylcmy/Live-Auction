/**
 * Shared test environment preparation: Docker, migrations, Redis flush, health checks.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import knex from 'knex';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export interface PrepareTestEnvOptions {
  /** Skip `docker compose up` when containers are already running (e.g. CI). */
  skipDocker?: boolean;
  /** Fail when total duration exceeds 120s (SC-011). */
  assertMaxDurationMs?: number;
}

export interface PrepareTestEnvResult {
  durationMs: number;
  mysqlHealthy: boolean;
  redisHealthy: boolean;
  redisFlushed: boolean;
}

function run(command: string, cwd = backendRoot): void {
  execSync(command, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });
}

function loadTestEnv(): void {
  dotenv.config({ path: path.join(backendRoot, '.env.test') });
}

async function waitForMysql(): Promise<boolean> {
  const client = knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'testpass',
      database: process.env.DB_NAME || 'live_auction_test',
    },
    pool: { min: 0, max: 1 },
  });
  try {
    await client.raw('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.destroy();
  }
}

async function flushRedis(): Promise<boolean> {
  const url = process.env.REDIS_URL || 'redis://localhost:6380';
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
  try {
    await redis.ping();
    await redis.flushall();
    return true;
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
}

export async function prepareTestEnvironment(
  options: PrepareTestEnvOptions = {},
): Promise<PrepareTestEnvResult> {
  const startedAt = Date.now();
  loadTestEnv();

  if (!options.skipDocker) {
    try {
      run('docker compose -f docker-compose.test.yml up -d --wait');
    } catch (err) {
      throw new Error(
        'Docker compose failed. Start Docker Desktop or set SKIP_DOCKER_PREPARE=1 when MySQL(3307)/Redis(6380) are already up.',
        { cause: err },
      );
    }
  }

  run('pnpm migrate:latest');

  const mysqlHealthy = await waitForMysql();
  if (!mysqlHealthy) {
    throw new Error('MySQL health check failed after migrate:latest');
  }

  const redisFlushed = await flushRedis();
  const redisHealthy = redisFlushed;
  if (!redisHealthy) {
    throw new Error('Redis health check or FLUSHALL failed');
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    JSON.stringify({
      event: 'test_env_prepared',
      durationMs,
      mysqlHealthy,
      redisHealthy,
      redisFlushed,
    }),
  );

  const maxMs = options.assertMaxDurationMs ?? 120_000;
  if (durationMs >= maxMs) {
    throw new Error(
      `test env prepare exceeded ${maxMs}ms (took ${durationMs}ms, SC-011)`,
    );
  }

  return { durationMs, mysqlHealthy, redisHealthy, redisFlushed };
}
