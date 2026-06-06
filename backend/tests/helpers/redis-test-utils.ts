import { redis, redisCircuitBreaker } from '../../src/infrastructure/cache/redis.js';

export async function flushAll(): Promise<void> {
  await redis.flushall();
}

/**
 * Simulate Redis outage for fallback tests.
 * Trips the circuit breaker to open state and sets a very long open duration
 * to prevent half-open probes (which would hang due to ioredis retries).
 */
export function simulateRedisOutage(): void {
  redisCircuitBreaker.trip();
  // Prevent half-open transition for the duration of the test
  (redisCircuitBreaker as any).opts.openDurationMs = 24 * 60 * 60 * 1000; // 24 hours
}

/** Disconnect Redis client to simulate outage (circuit breaker / fallback tests). */
export async function disconnectRedis(): Promise<void> {
  redis.disconnect(false);
}

/** Reconnect after fault injection. */
export async function reconnectRedis(): Promise<void> {
  if (redis.status === 'end' || redis.status === 'close') {
    await redis.connect();
    return;
  }
  if (redis.status !== 'ready') {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        redis.off('error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        redis.off('ready', onReady);
        reject(err);
      };
      redis.once('ready', onReady);
      redis.once('error', onError);
    });
  }
}

/**
 * Restore Redis availability after outage simulation.
 * Resets circuit breaker and restores default open duration.
 */
export function restoreRedisAvailability(): void {
  (redisCircuitBreaker as any).opts.openDurationMs = 5000; // restore default
  redisCircuitBreaker.reset();
}

export async function getDbKeyCount(): Promise<number> {
  return redis.dbsize();
}
