import { describe, it, expect } from 'vitest';
import {
  AUCTION_STATUS_CONFIG,
  PRODUCT_STATUS_STYLES,
  ORDER_STATUS_CONFIG,
  ORDER_STATUS_STYLES,
  ROOM_STATUS_STYLES,
} from '../statusConfig';

// ---------------------------------------------------------------------------
// AUCTION_STATUS_CONFIG
// ---------------------------------------------------------------------------
describe('AUCTION_STATUS_CONFIG', () => {
  const expectedStatuses = ['listed', 'active', 'ended', 'unsold', 'cancelled'] as const;

  it.each(expectedStatuses)('has a config entry for "%s"', (status) => {
    expect(AUCTION_STATUS_CONFIG[status]).toBeDefined();
  });

  it.each(expectedStatuses)('each entry has label, className, icon, and priceLabel for "%s"', (status) => {
    const config = AUCTION_STATUS_CONFIG[status];
    expect(config).toHaveProperty('label');
    expect(config).toHaveProperty('className');
    expect(config).toHaveProperty('icon');
    expect(config).toHaveProperty('priceLabel');
    expect(typeof config.label).toBe('string');
    expect(typeof config.className).toBe('string');
    expect(typeof config.priceLabel).toBe('string');
  });

  it('maps known labels correctly', () => {
    expect(AUCTION_STATUS_CONFIG.listed.label).toBe('待拍');
    expect(AUCTION_STATUS_CONFIG.active.label).toBe('竞拍中');
    expect(AUCTION_STATUS_CONFIG.ended.label).toBe('已成交');
    expect(AUCTION_STATUS_CONFIG.unsold.label).toBe('流拍');
    expect(AUCTION_STATUS_CONFIG.cancelled.label).toBe('已取消');
  });
});

// ---------------------------------------------------------------------------
// PRODUCT_STATUS_STYLES
// ---------------------------------------------------------------------------
describe('PRODUCT_STATUS_STYLES', () => {
  const expectedStatuses = ['pending', 'listed', 'active', 'ended', 'unsold', 'deleted'] as const;

  it.each(expectedStatuses)('has a style entry for "%s"', (status) => {
    expect(PRODUCT_STATUS_STYLES[status]).toBeDefined();
  });

  it.each(expectedStatuses)('each entry has bg, text, dot, and label for "%s"', (status) => {
    const style = PRODUCT_STATUS_STYLES[status];
    expect(style).toHaveProperty('bg');
    expect(style).toHaveProperty('text');
    expect(style).toHaveProperty('dot');
    expect(style).toHaveProperty('label');
    expect(typeof style.bg).toBe('string');
    expect(typeof style.text).toBe('string');
    expect(typeof style.dot).toBe('string');
    expect(typeof style.label).toBe('string');
  });

  it('maps known labels correctly', () => {
    expect(PRODUCT_STATUS_STYLES.pending.label).toBe('等待上架');
    expect(PRODUCT_STATUS_STYLES.listed.label).toBe('上架待竞拍');
    expect(PRODUCT_STATUS_STYLES.active.label).toBe('竞拍中');
    expect(PRODUCT_STATUS_STYLES.ended.label).toBe('已结束');
    expect(PRODUCT_STATUS_STYLES.unsold.label).toBe('流拍');
    expect(PRODUCT_STATUS_STYLES.deleted.label).toBe('已删除');
  });
});

// ---------------------------------------------------------------------------
// ORDER_STATUS_CONFIG
// ---------------------------------------------------------------------------
describe('ORDER_STATUS_CONFIG', () => {
  const expectedStatuses = ['pending_payment', 'paid', 'completed', 'cancelled'] as const;

  it.each(expectedStatuses)('has a config entry for "%s"', (status) => {
    expect(ORDER_STATUS_CONFIG[status]).toBeDefined();
  });

  it.each(expectedStatuses)('each entry has variant, label, icon, and className for "%s"', (status) => {
    const config = ORDER_STATUS_CONFIG[status];
    expect(config).toHaveProperty('variant');
    expect(config).toHaveProperty('label');
    expect(config).toHaveProperty('icon');
    expect(config).toHaveProperty('className');
    expect(typeof config.label).toBe('string');
    expect(typeof config.className).toBe('string');
  });

  it('maps known labels correctly', () => {
    expect(ORDER_STATUS_CONFIG.pending_payment.label).toBe('待支付');
    expect(ORDER_STATUS_CONFIG.paid.label).toBe('已支付');
    expect(ORDER_STATUS_CONFIG.completed.label).toBe('已完成');
    expect(ORDER_STATUS_CONFIG.cancelled.label).toBe('已取消');
  });
});

// ---------------------------------------------------------------------------
// ORDER_STATUS_STYLES
// ---------------------------------------------------------------------------
describe('ORDER_STATUS_STYLES', () => {
  const expectedStatuses = ['pending_payment', 'paid', 'completed', 'cancelled'] as const;

  it.each(expectedStatuses)('has a style entry for "%s"', (status) => {
    expect(ORDER_STATUS_STYLES[status]).toBeDefined();
  });

  it.each(expectedStatuses)('each entry has bg, text, and label for "%s"', (status) => {
    const style = ORDER_STATUS_STYLES[status];
    expect(style).toHaveProperty('bg');
    expect(style).toHaveProperty('text');
    expect(style).toHaveProperty('label');
  });
});

// ---------------------------------------------------------------------------
// ROOM_STATUS_STYLES
// ---------------------------------------------------------------------------
describe('ROOM_STATUS_STYLES', () => {
  it('has entries for live and offline', () => {
    expect(ROOM_STATUS_STYLES.live).toBeDefined();
    expect(ROOM_STATUS_STYLES.offline).toBeDefined();
  });

  it('each entry has bg, text, dot, and label', () => {
    for (const status of ['live', 'offline']) {
      const style = ROOM_STATUS_STYLES[status];
      expect(style).toHaveProperty('bg');
      expect(style).toHaveProperty('text');
      expect(style).toHaveProperty('dot');
      expect(style).toHaveProperty('label');
    }
  });
});

// ---------------------------------------------------------------------------
// Snapshot tests (without React nodes — only serializable fields)
// ---------------------------------------------------------------------------
describe('statusConfig snapshots', () => {
  it('AUCTION_STATUS_CONFIG serializable fields remain stable', () => {
    const snapshot = Object.fromEntries(
      Object.entries(AUCTION_STATUS_CONFIG).map(([key, val]) => [
        key,
        { label: val.label, className: val.className, priceLabel: val.priceLabel },
      ]),
    );
    expect(snapshot).toMatchSnapshot();
  });

  it('PRODUCT_STATUS_STYLES remains stable', () => {
    expect(PRODUCT_STATUS_STYLES).toMatchSnapshot();
  });

  it('ORDER_STATUS_CONFIG serializable fields remain stable', () => {
    const snapshot = Object.fromEntries(
      Object.entries(ORDER_STATUS_CONFIG).map(([key, val]) => [
        key,
        { variant: val.variant, label: val.label, className: val.className },
      ]),
    );
    expect(snapshot).toMatchSnapshot();
  });

  it('ORDER_STATUS_STYLES remains stable', () => {
    expect(ORDER_STATUS_STYLES).toMatchSnapshot();
  });

  it('ROOM_STATUS_STYLES remains stable', () => {
    expect(ROOM_STATUS_STYLES).toMatchSnapshot();
  });
});
