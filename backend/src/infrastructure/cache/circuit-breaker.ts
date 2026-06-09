/**
 * Redis Circuit Breaker
 *
 * Three states: Closed (normal) → Open (failing) → Half-Open (probing)
 *
 * - Closed: All requests go through Redis. Failures are counted.
 * - Open: All requests skip Redis and use fallback. After `openDurationMs`,
 *   transitions to Half-Open on the next request.
 * - Half-Open: One probe request is allowed through Redis. If it succeeds,
 *   circuit closes. If it fails, circuit re-opens.
 */

import { logger } from '../../middleware/logger.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive failures before opening the circuit (default: 3) */
  failureThreshold: number;
  /** How long to stay open before allowing a probe (default: 5000ms) */
  openDurationMs: number;
  /** Called when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 3,
  openDurationMs: 5000,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private openedAt = 0;
  private probeInFlight = false;
  private readonly opts: CircuitBreakerOptions;

  constructor(opts: Partial<CircuitBreakerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  /**
   * Execute a function with circuit breaker protection.
   * If the circuit is open, the fallback is called instead.
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (Date.now() - this.openedAt >= this.opts.openDurationMs) {
        this.transitionTo('half-open');
      } else {
        return fallback();
      }
    }

    if (this.state === 'half-open') {
      if (this.probeInFlight) {
        return fallback();
      }
      this.probeInFlight = true;
      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (err) {
        this.onFailure();
        return fallback();
      } finally {
        this.probeInFlight = false;
      }
    }

    // Closed state
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      return fallback();
    }
  }

  /**
   * Check if Redis is currently available (circuit is closed or half-open).
   * Use this for lightweight checks before deciding which code path to take.
   */
  isAvailable(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (Date.now() - this.openedAt >= this.opts.openDurationMs) {
        this.transitionTo('half-open');
        return true; // Allow a probe
      }
      return false;
    }
    // Half-open: allow only one probe
    return !this.probeInFlight;
  }

  /**
   * Get the current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Record a successful operation (for external callers like health checks).
   */
  reportSuccess(): void {
    this.onSuccess();
  }

  /**
   * Record a failed operation (for external callers).
   */
  reportFailure(): void {
    this.onFailure();
  }

  /**
   * Force the circuit open (e.g., on startup when Redis is unavailable).
   */
  trip(): void {
    if (this.state !== 'open') {
      this.transitionTo('open');
    }
  }

  /**
   * Force the circuit closed (e.g., on startup when Redis is available).
   */
  reset(): void {
    if (this.state !== 'closed') {
      this.transitionTo('closed');
    }
    this.failureCount = 0;
  }

  /**
   * Set or update the onStateChange callback.
   * Useful for registering callbacks after construction.
   */
  setOnStateChange(callback: (from: CircuitState, to: CircuitState) => void): void {
    this.opts.onStateChange = callback;
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.transitionTo('closed');
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.state === 'closed' && this.failureCount >= this.opts.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'open') {
      this.openedAt = Date.now();
      logger.warn(
        { event: 'circuit_breaker_open', from: oldState },
        'Redis circuit breaker OPENED - switching to fallback mode',
      );
    } else if (newState === 'closed') {
      logger.info(
        { event: 'circuit_breaker_closed', from: oldState },
        'Redis circuit breaker CLOSED - Redis recovered',
      );
    } else if (newState === 'half-open') {
      logger.info(
        { event: 'circuit_breaker_half_open', from: oldState },
        'Redis circuit breaker HALF-OPEN - probing Redis',
      );
    }

    this.opts.onStateChange?.(oldState, newState);
  }
}
