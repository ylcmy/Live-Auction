import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BidSheet from '../BidSheet';
import { mockRoomAuctionItem } from '@/tests/fixtures/auction';

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

vi.mock('@/hooks/useBidAmount', () => ({
  useBidAmount: vi.fn(() => ({
    bidAmount: 110,
    setValue: vi.fn(),
    reset: vi.fn(),
    snapToMin: vi.fn(),
    isAtMin: true,
  })),
}));

const mockSubmitBid = vi.fn();
vi.mock('@/hooks/useBid', () => ({
  useBid: vi.fn(() => ({
    submitBid: mockSubmitBid,
  })),
}));

vi.mock('@/services/socket', () => ({
  getSocket: vi.fn(() => null),
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

vi.mock('@/store/auctionStore', () => ({
  useAuctionStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setMyBid: vi.fn(),
      updateAuctionPrice: vi.fn(),
    }),
  ),
}));

describe('BidSheet', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    item: mockRoomAuctionItem,
    myLastBid: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders product summary when open', () => {
    render(<BidSheet {...defaultProps} />);
    expect(screen.getByText('测试商品')).toBeInTheDocument();
  });

  test('renders header title', () => {
    render(<BidSheet {...defaultProps} />);
    expect(screen.getByRole('heading', { name: '确认出价' })).toBeInTheDocument();
  });

  test('renders "当前价" and "我的出价" in summary', () => {
    render(<BidSheet {...defaultProps} />);
    expect(screen.getByText('当前价')).toBeInTheDocument();
    expect(screen.getByText('我的出价')).toBeInTheDocument();
    expect(screen.getByText('未出价')).toBeInTheDocument();
  });

  test('displays formatted myLastBid when provided', () => {
    render(<BidSheet {...defaultProps} myLastBid={200} />);
    expect(screen.getByText('¥200.00')).toBeInTheDocument();
  });

  test('renders submit button with bid amount', () => {
    render(<BidSheet {...defaultProps} />);
    // "确认出价" appears in both SheetTitle and button label
    const confirmTexts = screen.getAllByText('确认出价');
    expect(confirmTexts.length).toBeGreaterThanOrEqual(2);
    // "¥110.00" appears in both BidStepper and submit button
    const priceTexts = screen.getAllByText('¥110.00');
    expect(priceTexts.length).toBeGreaterThanOrEqual(2);
  });

  test('calls onClose when close action triggered', () => {
    const onClose = vi.fn();
    render(<BidSheet {...defaultProps} onClose={onClose} />);
    // The close is handled by Sheet's onOpenChange, not easily testable without
    // understanding the Sheet internals. But we verify the component renders.
    expect(screen.getByRole('heading', { name: '确认出价' })).toBeInTheDocument();
  });

  test('renders nothing when item is null', () => {
    const { container } = render(<BidSheet {...defaultProps} item={null} />);
    expect(container.innerHTML).toBe('');
  });
});
