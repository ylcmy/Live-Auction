import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import EmotionToast from '../EmotionToast';
import type { EmotionEvent } from '@/types/ws';

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

let mockEmotionEvent: EmotionEvent | null = null;
const mockClearEmotion = vi.fn();

vi.mock('@/store/auctionStore', () => ({
  useAuctionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      emotionEvent: mockEmotionEvent,
      clearEmotion: mockClearEmotion,
    }),
}));

describe('EmotionToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockEmotionEvent = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders nothing when no emotion event', () => {
    mockEmotionEvent = null;
    const { container } = render(<EmotionToast />);
    expect(container.innerHTML).toBe('');
  });

  test('renders lead event with correct text', () => {
    mockEmotionEvent = {
      sessionId: 1,
      userId: 2,
      amount: 200,
      type: 'lead',
    };
    render(<EmotionToast />);
    expect(screen.getByText('领先！')).toBeInTheDocument();
    expect(screen.getByText('¥200.00')).toBeInTheDocument();
  });

  test('renders overtaken event with correct text', () => {
    mockEmotionEvent = {
      sessionId: 1,
      userId: 3,
      amount: 300,
      type: 'overtaken',
    };
    render(<EmotionToast />);
    expect(screen.getByText('被超越！')).toBeInTheDocument();
    expect(screen.getByText('¥300.00')).toBeInTheDocument();
  });

  test('auto-dismisses after 3 seconds', () => {
    mockEmotionEvent = {
      sessionId: 1,
      userId: 2,
      amount: 200,
      type: 'lead',
    };
    render(<EmotionToast />);

    expect(mockClearEmotion).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockClearEmotion).toHaveBeenCalledTimes(1);
  });

  test('renders extended event with extend seconds', () => {
    mockEmotionEvent = {
      sessionId: 1,
      userId: 2,
      amount: 200,
      type: 'extended',
      extendSeconds: 30,
    };
    render(<EmotionToast />);
    expect(screen.getByText('延时 +30s')).toBeInTheDocument();
    expect(screen.getByText('竞拍时间已延长')).toBeInTheDocument();
  });

  test('renders ended event', () => {
    mockEmotionEvent = {
      sessionId: 1,
      userId: 2,
      amount: 500,
      type: 'ended',
    };
    render(<EmotionToast />);
    expect(screen.getByText('竞拍结束')).toBeInTheDocument();
  });

  test('renders cancelled event', () => {
    mockEmotionEvent = {
      sessionId: 1,
      userId: 2,
      amount: 0,
      type: 'cancelled',
    };
    render(<EmotionToast />);
    expect(screen.getByText('竞拍已取消')).toBeInTheDocument();
  });
});
