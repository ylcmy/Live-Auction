import { logger } from '../../src/middleware/logger.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface CapturedLog {
  level: LogLevel;
  event?: string;
  msg?: string;
  [key: string]: unknown;
}

const LEVELS: LogLevel[] = ['info', 'warn', 'error', 'debug'];

function normalizeEntry(
  level: LogLevel,
  obj: unknown,
  msg?: string,
): CapturedLog {
  if (typeof obj === 'string') {
    return { level, msg: obj };
  }
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    return {
      level,
      ...record,
      msg: typeof msg === 'string' ? msg : (record.msg as string | undefined),
      event: record.event as string | undefined,
    };
  }
  return { level, msg };
}

export class LogCapture {
  private entries: CapturedLog[] = [];
  private originals: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {};

  start(): void {
    this.entries = [];
    for (const level of LEVELS) {
      const original = (logger as unknown as Record<string, (...args: unknown[]) => void>)[
        level
      ].bind(logger);
      this.originals[level] = original;
      (logger as unknown as Record<string, (...args: unknown[]) => void>)[level] = (
        obj: unknown,
        msg?: string,
      ) => {
        this.entries.push(normalizeEntry(level, obj, msg));
        return original(obj, msg);
      };
    }
  }

  stop(): void {
    for (const level of LEVELS) {
      const original = this.originals[level];
      if (original) {
        (logger as unknown as Record<string, (...args: unknown[]) => void>)[level] =
          original;
      }
    }
    this.originals = {};
  }

  getLogs(): CapturedLog[] {
    return [...this.entries];
  }

  findByEvent(event: string): CapturedLog[] {
    return this.entries.filter((e) => e.event === event);
  }

  assertEvent(
    event: string,
    predicate?: (entry: CapturedLog) => boolean,
  ): CapturedLog {
    const matches = this.findByEvent(event).filter((e) =>
      predicate ? predicate(e) : true,
    );
    if (matches.length === 0) {
      throw new Error(
        `Expected log event "${event}" not found. Captured: ${JSON.stringify(
          this.entries.map((e) => e.event),
        )}`,
      );
    }
    return matches[matches.length - 1];
  }
}
