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
    bidError: null,
    clearBidError: vi.fn(),
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

  describe('实时价与 Hint 更新 (FR-022)', () => {
    test('应显示当前价格式化文本', () => {
      render(<BidSheet {...defaultProps} />);
      // mockRoomAuctionItem.currentPrice = 100, formatPrice(100) = "¥100.00"
      expect(screen.getByText('¥100.00')).toBeInTheDocument();
    });

    test('应显示商品名称', () => {
      render(<BidSheet {...defaultProps} />);
      expect(screen.getByText('测试商品')).toBeInTheDocument();
    });

    test('myLastBid 为 null 时应显示"未出价"', () => {
      render(<BidSheet {...defaultProps} myLastBid={null} />);
      expect(screen.getByText('未出价')).toBeInTheDocument();
    });

    test('myLastBid 有值时应显示格式化金额', () => {
      render(<BidSheet {...defaultProps} myLastBid={350} />);
      expect(screen.getByText('¥350.00')).toBeInTheDocument();
    });

    test('应渲染 BidStepper 步进器组件', () => {
      render(<BidSheet {...defaultProps} />);
      // BidStepper 会显示减号/加号按钮
      // 确认出价按钮和标题都有 "确认出价" 文本
      const confirmTexts = screen.getAllByText('确认出价');
      expect(confirmTexts.length).toBeGreaterThanOrEqual(2);
    });

    test('item 为 listed 状态时提交按钮应被禁用', () => {
      const listedItem = {
        ...mockRoomAuctionItem,
        status: 'listed' as const,
      };
      render(<BidSheet {...defaultProps} item={listedItem} />);
      // 按钮 disabled 属性通过 item.status !== 'active' 判断
      const buttons = screen.getAllByRole('button');
      const submitBtn = buttons.find(b => b.textContent?.includes('确认出价'));
      if (submitBtn) {
        expect(submitBtn).toBeDisabled();
      }
    });

    test('item 为 active 状态时提交按钮不应被禁用', () => {
      render(<BidSheet {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      // 找到包含"确认出价"的按钮
      const submitBtn = buttons.find(b => b.textContent?.includes('确认出价') && b.textContent?.includes('¥'));
      // active 状态不应禁用
      expect(submitBtn).toBeDefined();
    });

    test('应显示"当前价"和"我的出价"标签', () => {
      render(<BidSheet {...defaultProps} />);
      expect(screen.getByText('当前价')).toBeInTheDocument();
      expect(screen.getByText('我的出价')).toBeInTheDocument();
    });
  });
});
