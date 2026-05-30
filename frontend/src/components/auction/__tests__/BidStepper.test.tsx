import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BidStepper from '../BidStepper';

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

describe('BidStepper', () => {
  const defaultProps = {
    value: 110,
    min: 110,
    step: 10,
    onChange: vi.fn(),
  };

  test('renders current value', () => {
    render(<BidStepper {...defaultProps} />);
    expect(screen.getByText('¥110.00')).toBeInTheDocument();
  });

  test('renders step hint', () => {
    render(<BidStepper {...defaultProps} />);
    expect(screen.getByText(/每次加价/)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('¥10.00'))).toBeInTheDocument();
  });

  test('increment button increases value', () => {
    const onChange = vi.fn();
    render(<BidStepper {...defaultProps} onChange={onChange} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // increment is the second button

    expect(onChange).toHaveBeenCalledWith(120);
  });

  test('decrement button decreases value', () => {
    const onChange = vi.fn();
    render(<BidStepper {...defaultProps} value={120} onChange={onChange} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // decrement is the first button

    expect(onChange).toHaveBeenCalledWith(110);
  });

  test('decrement button is disabled at minimum value', () => {
    render(<BidStepper {...defaultProps} value={110} min={110} />);

    const buttons = screen.getAllByRole('button');
    const decrementButton = buttons[0];

    expect(decrementButton).toBeDisabled();
  });

  test('decrement button is enabled when above minimum', () => {
    render(<BidStepper {...defaultProps} value={120} min={110} />);

    const buttons = screen.getAllByRole('button');
    const decrementButton = buttons[0];

    expect(decrementButton).not.toBeDisabled();
  });

  test('does not call onChange when decrement is disabled and clicked', () => {
    const onChange = vi.fn();
    render(<BidStepper {...defaultProps} value={110} min={110} onChange={onChange} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
