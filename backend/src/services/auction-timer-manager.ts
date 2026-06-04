import { logger } from '../middleware/logger.js';

export class AuctionTimerManager {
  private timers: Map<number, NodeJS.Timeout> = new Map();

  clear(sessionId: number): void {
    const existing = this.timers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(sessionId);
    }
  }

  schedule(sessionId: number, delayMs: number, callback: () => Promise<unknown>): void {
    this.clear(sessionId);
    const timer = setTimeout(async () => {
      this.timers.delete(sessionId);
      try {
        await callback();
      } catch (err) {
        logger.error({ event: 'settle_timer_error', sessionId, err }, 'Auction settlement timer failed');
      }
    }, delayMs);
    this.timers.set(sessionId, timer);
    logger.info({ event: 'settlement_scheduled', sessionId, delayMs }, 'Auction settlement timer scheduled');
  }

  clearAll(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  async restoreTimers(
    sessions: Array<{ id: number; endTimeMs: number }>,
    settleCallback: (sessionId: number) => Promise<unknown>,
  ): Promise<void> {
    const now = Date.now();
    let restored = 0;
    let settledNow = 0;

    for (const session of sessions) {
      const delayMs = session.endTimeMs - now;

      if (delayMs <= 0) {
        logger.info({ event: 'timer_restore_settle_now', sessionId: session.id }, 'Restoring expired auction - settling immediately');
        try {
          await settleCallback(session.id);
          settledNow++;
        } catch (err) {
          logger.error({ event: 'timer_restore_settle_error', sessionId: session.id, err }, 'Failed to settle expired auction on restore');
        }
      } else {
        this.schedule(session.id, delayMs, () => settleCallback(session.id));
        logger.info({ event: 'timer_restore_scheduled', sessionId: session.id, delayMs }, 'Restored auction timer');
        restored++;
      }
    }

    logger.info({ event: 'timer_restore_done', restored, settledNow, total: sessions.length }, 'Timer restore completed');
  }
}
