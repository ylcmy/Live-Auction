import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from '../ProductCard';
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

describe('ProductCard', () => {
  const defaultProps = {
    item: mockRoomAuctionItem,
    isCurrent: false,
    myLastBid: null,
    onSelect: vi.fn(),
    onBid: vi.fn(),
  };

  test('renders product name', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('测试商品')).toBeInTheDocument();
  });

  test('shows status label for active item', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('竞拍中')).toBeInTheDocument();
  });

  test('shows "去出价" button when status is active', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('去出价')).toBeInTheDocument();
  });

  test('shows "去看看" button when status is not active', () => {
    render(<ProductCard {...defaultProps} item={mockListedAuction} />);
    expect(screen.getByText('去看看')).toBeInTheDocument();
    expect(screen.queryByText('去出价')).not.toBeInTheDocument();
  });

  test('shows correct price for active item with price above startPrice', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('当前最高价')).toBeInTheDocument();
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
  });

  test('shows start price label for listed item', () => {
    render(<ProductCard {...defaultProps} item={mockListedAuction} />);
    expect(screen.getByText('起拍价')).toBeInTheDocument();
  });

  test('shows ended label for ended item', () => {
    render(<ProductCard {...defaultProps} item={mockEndedAuction} />);
    expect(screen.getByText('已成交')).toBeInTheDocument();
  });

  test('shows "讲解中" indicator when isCurrent is true', () => {
    render(<ProductCard {...defaultProps} isCurrent={true} />);
    expect(screen.getByText('讲解中')).toBeInTheDocument();
  });

  test('does not show "讲解中" when isCurrent is false', () => {
    render(<ProductCard {...defaultProps} isCurrent={false} />);
    expect(screen.queryByText('讲解中')).not.toBeInTheDocument();
  });

  test('calls onBid when "去出价" button is clicked', () => {
    const onBid = vi.fn();
    render(<ProductCard {...defaultProps} onBid={onBid} />);

    fireEvent.click(screen.getByText('去出价'));

    expect(onBid).toHaveBeenCalledTimes(1);
  });

  test('calls onSelect when card is clicked', () => {
    const onSelect = vi.fn();
    render(<ProductCard {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('测试商品').closest('[class*="cursor-pointer"]')!);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('calls onSelect when "去看看" button is clicked for non-active item', () => {
    const onSelect = vi.fn();
    render(<ProductCard {...defaultProps} item={mockListedAuction} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('去看看'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('renders product image when imageUrl is present', () => {
    render(<ProductCard {...defaultProps} />);
    const img = screen.getByAltText('测试商品');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  test('renders index badge when index is provided', () => {
    render(<ProductCard {...defaultProps} index={0} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
