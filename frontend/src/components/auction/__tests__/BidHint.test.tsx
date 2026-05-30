import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BidHint from '../BidHint';

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

describe('BidHint', () => {
  test('shows leading message when isLeading is true', () => {
    render(<BidHint bidAmount={200} currentPrice={200} isLeading={true} />);
    expect(screen.getByText('当前您已是最高价')).toBeInTheDocument();
  });

  test('shows "above current price" when bidAmount > currentPrice', () => {
    render(<BidHint bidAmount={200} currentPrice={150} isLeading={false} />);
    expect(screen.getByText(/高于当前价/)).toBeInTheDocument();
    expect(screen.getByText(/¥50\.00/)).toBeInTheDocument();
  });

  test('shows "not lower than current price" when bidAmount <= currentPrice', () => {
    render(<BidHint bidAmount={100} currentPrice={100} isLeading={false} />);
    expect(screen.getByText('出价不低于当前价')).toBeInTheDocument();
  });

  test('shows leading message regardless of amount when isLeading', () => {
    render(<BidHint bidAmount={300} currentPrice={150} isLeading={true} />);
    expect(screen.getByText('当前您已是最高价')).toBeInTheDocument();
    // Should NOT show the "above" message
    expect(screen.queryByText(/高于当前价/)).not.toBeInTheDocument();
  });

  test('shows correct diff amount when above current price', () => {
    render(<BidHint bidAmount={130} currentPrice={100} isLeading={false} />);
    expect(screen.getByText(/¥30\.00/)).toBeInTheDocument();
  });
});
