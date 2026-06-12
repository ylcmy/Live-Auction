import { redis, isRedisAvailable } from '../infrastructure/cache/redis.js';
import { logger } from '../middleware/logger.js';

const CAPTCHA_TTL = 300; // 5 minutes
const POSITION_TOLERANCE = 5; // ±5px tolerance

interface CaptchaData {
  x: number;
  createdAt: number;
}

export const captchaService = {
  /**
   * Store the puzzle X position for a captcha session.
   * Called by the frontend after createPuzzle() generates the puzzle.
   */
  async storePosition(sessionId: string, x: number): Promise<void> {
    if (!isRedisAvailable()) {
      logger.warn({ event: 'auth.captcha_degraded', reason: 'redis_unavailable' });
      return;
    }

    const data: CaptchaData = { x, createdAt: Date.now() };
    await redis.set(`captcha:${sessionId}`, JSON.stringify(data), 'EX', CAPTCHA_TTL);
  },

  /**
   * Verify a captcha submission.
   *
   * Security model: sessionId is a server-generated 128-bit UUID returned by
   * GET /api/auth/captcha and stored in Redis with a 5-minute TTL. Its
   * unpredictability is the sole basis for trust — the frontend cannot
   * forge a valid submission without first obtaining a session, and each
   * session is consumed exactly once via DEL.
   *
   * @param sessionId - The captcha session id (UUID v4 from server)
   * @param submittedX - The X position the user dragged the slider to
   * @returns true if the session exists and submittedX is within tolerance of the stored X
   */
  async verify(sessionId: string, submittedX: number): Promise<boolean> {
    if (!isRedisAvailable()) {
      logger.warn({ event: 'auth.captcha_failed', sessionId, reason: 'redis_unavailable' });
      return false;
    }

    const raw = await redis.get(`captcha:${sessionId}`);
    if (!raw) {
      logger.warn({ event: 'auth.captcha_failed', sessionId, reason: 'expired_or_not_found' });
      return false;
    }

    // Delete immediately (one-time use)
    await redis.del(`captcha:${sessionId}`);

    let data: CaptchaData;
    try {
      data = JSON.parse(raw);
    } catch {
      logger.warn({ event: 'auth.captcha_failed', sessionId, reason: 'invalid_data' });
      return false;
    }

    if (typeof data.x !== 'number' || typeof submittedX !== 'number') {
      logger.warn({ event: 'auth.captcha_failed', sessionId, reason: 'invalid_x' });
      return false;
    }

    if (Math.abs(submittedX - data.x) > POSITION_TOLERANCE) {
      logger.warn({
        event: 'auth.captcha_failed', sessionId, reason: 'position_mismatch',
        expected: data.x, submitted: submittedX,
      });
      return false;
    }

    return true;
  },
};
