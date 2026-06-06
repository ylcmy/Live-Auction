import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
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

// emotionEvents 数组 + removeEmotion（匹配真实 store API）
let mockEmotionEvents: Array<EmotionEvent & { id: string }> = [];
const mockRemoveEmotion = vi.fn();

vi.mock('@/store/auctionStore', () => ({
  useAuctionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      emotionEvents: mockEmotionEvents,
      removeEmotion: mockRemoveEmotion,
    }),
}));

describe('EmotionToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockEmotionEvents = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders nothing when no emotion event', () => {
    mockEmotionEvents = [];
    const { container } = render(<EmotionToast />);
    expect(container.innerHTML).toBe('');
  });

  test('renders lead event with correct text', () => {
    mockEmotionEvents = [
      { id: 'evt-1', sessionId: 1, userId: 2, amount: 200, type: 'lead' },
    ];
    render(<EmotionToast />);
    expect(screen.getByText('领先！')).toBeInTheDocument();
    expect(screen.getByText('¥200.00')).toBeInTheDocument();
  });

  test('renders overtaken event with correct text', () => {
    mockEmotionEvents = [
      { id: 'evt-2', sessionId: 1, userId: 3, amount: 300, type: 'overtaken' },
    ];
    render(<EmotionToast />);
    expect(screen.getByText('被超越！')).toBeInTheDocument();
    expect(screen.getByText('¥300.00')).toBeInTheDocument();
  });

  test('auto-dismisses after 3 seconds', () => {
    mockEmotionEvents = [
      { id: 'evt-3', sessionId: 1, userId: 2, amount: 200, type: 'lead' },
    ];
    render(<EmotionToast />);

    expect(mockRemoveEmotion).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockRemoveEmotion).toHaveBeenCalledWith('evt-3');
  });

  test('renders extended event with extend seconds', () => {
    mockEmotionEvents = [
      { id: 'evt-4', sessionId: 1, userId: 2, amount: 200, type: 'extended', extendSeconds: 30 },
    ];
    render(<EmotionToast />);
    expect(screen.getByText('延时 +30s')).toBeInTheDocument();
    expect(screen.getByText('竞拍时间已延长')).toBeInTheDocument();
  });

  test('renders ended event', () => {
    mockEmotionEvents = [
      { id: 'evt-5', sessionId: 1, userId: 2, amount: 500, type: 'ended' },
    ];
    render(<EmotionToast />);
    expect(screen.getByText('竞拍结束')).toBeInTheDocument();
  });

  test('renders cancelled event', () => {
    mockEmotionEvents = [
      { id: 'evt-6', sessionId: 1, userId: 2, amount: 0, type: 'cancelled' },
    ];
    render(<EmotionToast />);
    expect(screen.getByText('竞拍已取消')).toBeInTheDocument();
  });

  describe('领先/被超越动画触发 (FR-022)', () => {
    test('lead 事件应显示领先文案和金额', () => {
      mockEmotionEvents = [
        { id: 'evt-10', sessionId: 1, userId: 2, amount: 500, type: 'lead' },
      ];
      render(<EmotionToast />);
      expect(screen.getByText('领先！')).toBeInTheDocument();
      expect(screen.getByText('¥500.00')).toBeInTheDocument();
    });

    test('overtaken 事件应显示被超越文案和金额', () => {
      mockEmotionEvents = [
        { id: 'evt-11', sessionId: 1, userId: 3, amount: 600, type: 'overtaken' },
      ];
      render(<EmotionToast />);
      expect(screen.getByText('被超越！')).toBeInTheDocument();
      expect(screen.getByText('¥600.00')).toBeInTheDocument();
    });

    test('lead 和 overtaken 事件可同时显示', () => {
      mockEmotionEvents = [
        { id: 'evt-12', sessionId: 1, userId: 2, amount: 500, type: 'lead' },
        { id: 'evt-13', sessionId: 1, userId: 3, amount: 600, type: 'overtaken' },
      ];
      render(<EmotionToast />);
      expect(screen.getByText('领先！')).toBeInTheDocument();
      expect(screen.getByText('被超越！')).toBeInTheDocument();
    });

    test('事件 3 秒后应调用 removeEmotion 清除', () => {
      mockEmotionEvents = [
        { id: 'evt-14', sessionId: 1, userId: 2, amount: 500, type: 'lead' },
      ];
      render(<EmotionToast />);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockRemoveEmotion).toHaveBeenCalledWith('evt-14');
    });

    test('多个事件各自独立计时清除', () => {
      mockEmotionEvents = [
        { id: 'evt-15', sessionId: 1, userId: 2, amount: 500, type: 'lead' },
        { id: 'evt-16', sessionId: 1, userId: 3, amount: 600, type: 'overtaken' },
      ];
      render(<EmotionToast />);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // 两个事件都应在 3 秒后被清除
      expect(mockRemoveEmotion).toHaveBeenCalledWith('evt-15');
      expect(mockRemoveEmotion).toHaveBeenCalledWith('evt-16');
    });

    test('extended 事件应显示延时秒数', () => {
      mockEmotionEvents = [
        { id: 'evt-17', sessionId: 1, type: 'extended', extendSeconds: 15 },
      ];
      render(<EmotionToast />);
      expect(screen.getByText('延时 +15s')).toBeInTheDocument();
    });

    test('ended 事件应显示竞拍结束', () => {
      mockEmotionEvents = [
        { id: 'evt-18', sessionId: 1, type: 'ended', amount: 800 },
      ];
      render(<EmotionToast />);
      expect(screen.getByText('竞拍结束')).toBeInTheDocument();
    });

    test('空事件数组应不渲染任何内容', () => {
      mockEmotionEvents = [];
      const { container } = render(<EmotionToast />);
      expect(container.innerHTML).toBe('');
    });
  });
});
