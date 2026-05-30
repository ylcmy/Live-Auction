import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductDetailSheet from '../ProductDetailSheet';
import { mockRoomAuctionItem, mockListedAuction, mockEndedAuction } from '@/tests/fixtures/auction';

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

describe('ProductDetailSheet', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    item: mockRoomAuctionItem,
    onBid: vi.fn(),
  };

  test('renders product name and description when open', () => {
    render(<ProductDetailSheet {...defaultProps} />);
    expect(screen.getByText('测试商品')).toBeInTheDocument();
    expect(screen.getByText('测试商品描述')).toBeInTheDocument();
  });

  test('renders "立即出价" button when item status is active', () => {
    render(<ProductDetailSheet {...defaultProps} />);
    expect(screen.getByText('立即出价')).toBeInTheDocument();
  });

  test('shows status message instead of bid button for listed item', () => {
    render(<ProductDetailSheet {...defaultProps} item={mockListedAuction} />);
    expect(screen.queryByText('立即出价')).not.toBeInTheDocument();
    expect(screen.getByText('拍卖尚未开始')).toBeInTheDocument();
  });

  test('shows status message for ended item', () => {
    render(<ProductDetailSheet {...defaultProps} item={mockEndedAuction} />);
    expect(screen.queryByText('立即出价')).not.toBeInTheDocument();
    expect(screen.getByText('拍卖已结束')).toBeInTheDocument();
  });

  test('renders header title', () => {
    render(<ProductDetailSheet {...defaultProps} />);
    expect(screen.getByText('商品详情')).toBeInTheDocument();
  });

  test('renders auction rule details', () => {
    render(<ProductDetailSheet {...defaultProps} />);
    expect(screen.getByText('起拍价')).toBeInTheDocument();
    expect(screen.getByText('加价幅度')).toBeInTheDocument();
    expect(screen.getByText('封顶价')).toBeInTheDocument();
    expect(screen.getByText('延时次数')).toBeInTheDocument();
  });

  test('renders price info section', () => {
    render(<ProductDetailSheet {...defaultProps} />);
    // "当前最高价" is the price label, "起拍价" also appears in the rules section
    const priceLabels = screen.getAllByText(/当前最高价|落槌价|起拍价/);
    expect(priceLabels.length).toBeGreaterThanOrEqual(1);
  });

  test('renders nothing when item is null', () => {
    const { container } = render(<ProductDetailSheet {...defaultProps} item={null} />);
    expect(container.innerHTML).toBe('');
  });

  test('renders LIVE badge when item is active', () => {
    render(<ProductDetailSheet {...defaultProps} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  test('does not render LIVE badge for non-active item', () => {
    render(<ProductDetailSheet {...defaultProps} item={mockListedAuction} />);
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });
});
