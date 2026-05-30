import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CartPanel from '../CartPanel';
import { mockRoomAuctionItem, mockListedAuction, mockMyBids } from '@/tests/fixtures/auction';

vi.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy({}, {
      get: (_target, tag: string) => {
        const MotionComponent = (props: Record<string, unknown>) => {
          const { whileTap, whileHover, initial, animate, exit, transition, variants, key, ...rest } = props;
          return React.createElement(tag, rest);
        };
        return MotionComponent;
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const mockStoreState: Record<string, unknown> = {
  myBids: mockMyBids,
};

vi.mock('@/store/auctionStore', () => ({
  useAuctionStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));

describe('CartPanel', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    auctions: [mockRoomAuctionItem, mockListedAuction],
    currentSessionId: 1,
    onSelectProduct: vi.fn(),
  };

  test('renders auction items when open', () => {
    render(<CartPanel {...defaultProps} />);
    expect(screen.getByText('测试商品')).toBeInTheDocument();
    expect(screen.getByText('待拍商品')).toBeInTheDocument();
  });

  test('renders item count badge', () => {
    render(<CartPanel {...defaultProps} />);
    expect(screen.getByText('2 件')).toBeInTheDocument();
  });

  test('renders header title', () => {
    render(<CartPanel {...defaultProps} />);
    expect(screen.getByText('竞拍商品')).toBeInTheDocument();
  });

  test('shows empty message when auctions is empty', () => {
    render(<CartPanel {...defaultProps} auctions={[]} />);
    expect(screen.getByText('暂无商品')).toBeInTheDocument();
  });

  test('does not render content when open is false', () => {
    render(<CartPanel {...defaultProps} open={false} />);
    expect(screen.queryByText('竞拍商品')).not.toBeInTheDocument();
  });
});
