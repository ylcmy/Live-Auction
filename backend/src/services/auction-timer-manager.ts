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
}
