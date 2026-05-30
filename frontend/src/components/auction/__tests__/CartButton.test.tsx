import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CartButton from '../CartButton';

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

describe('CartButton', () => {
  test('renders without badge when productCount is 0', () => {
    render(<CartButton productCount={0} onClick={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  test('renders badge with productCount', () => {
    render(<CartButton productCount={5} onClick={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('renders 99+ when productCount exceeds 99', () => {
    render(<CartButton productCount={150} onClick={vi.fn()} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<CartButton productCount={3} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
