import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../middleware/logger.js';
import { orderRepo } from '../../repositories/order.repo.js';

const QUEUE_NAME = 'order-timeout';

// BullMQ requires maxRetriesPerRequest: null
let connection: Redis | null = null;
let orderTimeoutQueue: Queue | null = null;
let orderTimeoutWorker: Worker | null = null;

function getConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requirement
    });
  }
  return connection;
}

/**
 * Get or create the order timeout queue
 */
export function getOrderTimeoutQueue(): Queue {
  if (!orderTimeoutQueue) {
    orderTimeoutQueue = new Queue(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { age: 3600 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
  }
  return orderTimeoutQueue;
}

/**
 * Schedule an order expiry check job.
 * Called when an order is created; checks after 15 minutes delay.
 */
export async function scheduleOrderExpiryCheck(orderId: number): Promise<void> {
  try {
    const queue = getOrderTimeoutQueue();
    await queue.add('check-expiry', { orderId }, {
      jobId: `order-expiry-${orderId}`,
      delay: 15 * 60 * 1000, // 15 minutes
    });
    logger.info({ event: 'order_expiry_scheduled', orderId }, 'Order expiry check scheduled');
  } catch (err) {
    // Enqueue failure should not block the main flow; fallback full scan will handle it
    logger.error({ event: 'order_expiry_schedule_failed', orderId, err }, 'Failed to schedule order expiry check');
  }
}

/**
 * Start the order timeout worker
 */
export function startOrderTimeoutWorker(): void {
  if (orderTimeoutWorker) return;

  orderTimeoutWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { orderId } = job.data;
      logger.info({ event: 'order_expiry_check', orderId }, 'Checking order expiry');

      const order = await orderRepo.findById(orderId);
      if (!order) {
        logger.warn({ event: 'order_not_found', orderId }, 'Order not found for expiry check');
        return;
      }

      if (order.status !== 'pending_payment') {
        logger.info({ event: 'order_already_processed', orderId, status: order.status }, 'Order already processed, skipping');
        return;
      }

      // Cancel expired order
      await orderRepo.updateStatus(orderId, 'cancelled', { cancelled_at: new Date() });
      logger.info({ event: 'order_auto_cancelled', orderId }, 'Order auto-cancelled due to payment timeout');
    },
    {
      connection: getConnection(),
      concurrency: 5,
    },
  );

  orderTimeoutWorker.on('failed', (job, err) => {
    logger.error({ event: 'order_expiry_check_failed', jobId: job?.id, orderId: job?.data?.orderId, err }, 'Order expiry check failed');
  });

  orderTimeoutWorker.on('completed', (job) => {
    logger.debug({ event: 'order_expiry_check_completed', jobId: job.id, orderId: job.data.orderId }, 'Order expiry check completed');
  });

  logger.info({ event: 'order_timeout_worker_started' }, 'Order timeout worker started');
}

/**
 * Gracefully close the worker
 */
export async function closeOrderTimeoutWorker(): Promise<void> {
  if (orderTimeoutWorker) {
    await orderTimeoutWorker.close();
    orderTimeoutWorker = null;
  }
  if (orderTimeoutQueue) {
    await orderTimeoutQueue.close();
    orderTimeoutQueue = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
