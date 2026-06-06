// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProductCard from './ProductCard';
import type { RoomAuctionItem } from '../../types/api';

afterEach(() => cleanup());

vi.mock('../../store/auctionStore', () => ({
  useAuctionStore: (selector: any) => {
    const state = {
      countdownRemainingMs: 65000,
      currentAuction: { sessionId: 1 },
    };
    return selector(state);
  },
}));

const baseItem: RoomAuctionItem = {
  sessionId: 1,
  status: 'active',
  currentPrice: 100,
  startedAt: new Date().toISOString(),
  endedAt: null,
  extensionCount: 0,
  product: { id: 1, name: '测试商品', description: null, imageUrl: null },
  rule: { startPrice: 50, bidIncrement: 10, ceilingPrice: null, durationSeconds: 300, extendSeconds: 30, maxExtensions: 3 },
};

describe('ProductCard countdown', () => {
  it('shows countdown for current active auction item', () => {
    render(
      <ProductCard
        item={baseItem}
        isCurrent={true}
        myLastBid={null}
        onSelect={() => {}}
        onBid={() => {}}
      />,
    );
    expect(screen.getByText('01:05')).toBeDefined();
  });

  it('does not show countdown for non-current items', () => {
    render(
      <ProductCard
        item={baseItem}
        isCurrent={false}
        myLastBid={null}
        onSelect={() => {}}
        onBid={() => {}}
      />,
    );
    expect(screen.queryByText('01:05')).toBeNull();
  });
});
