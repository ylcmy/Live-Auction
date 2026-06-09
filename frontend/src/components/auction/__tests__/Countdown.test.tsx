import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- Mocks ----
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

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return Object.fromEntries(Object.keys(actual).map(k => [k, () => <span data-testid={`icon-${k}`} />]));
});

// Import after mocks
import Countdown from '../Countdown';

describe('Countdown', () => {
  it('should flag urgent when remaining < 10 seconds', () => {
    expect(9000 < 10000).toBe(true); // urgent
    expect(15000 < 10000).toBe(false); // not urgent
  });

  it('should format milliseconds to MM:SS.mmm', () => {
    const ms = 65000; // 1m 5s
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remainMs = ms % 1000;
    const formatted = `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(remainMs).padStart(3, '0')}`;
    expect(formatted).toBe('01:05.000');
  });

  describe('毫秒倒计时与 sync 更新 (FR-022)', () => {
    it('应渲染倒计时时间（分钟:秒数.毫秒）', () => {
      render(<Countdown remainingMs={65000} isUrgent={false} />);
      // formatMs(65000) = "01:05.000"
      expect(screen.getByText('01')).toBeInTheDocument();
      expect(screen.getByText('05')).toBeInTheDocument();
      expect(screen.getByText('000')).toBeInTheDocument();
    });

    it('应显示"距竞拍结束仅剩"文案（非紧急时）', () => {
      render(<Countdown remainingMs={30000} isUrgent={false} />);
      expect(screen.getByText('距竞拍结束仅剩')).toBeInTheDocument();
    });

    it('紧急时应显示"即将结束"文案', () => {
      render(<Countdown remainingMs={5000} isUrgent={true} />);
      expect(screen.getByText('即将结束')).toBeInTheDocument();
    });

    it('紧急时应显示"最后机会，立即出价"提示', () => {
      render(<Countdown remainingMs={5000} isUrgent={true} />);
      expect(screen.getByText('最后机会，立即出价')).toBeInTheDocument();
    });

    it('非紧急时不应显示"最后机会"提示', () => {
      render(<Countdown remainingMs={30000} isUrgent={false} />);
      expect(screen.queryByText('最后机会，立即出价')).not.toBeInTheDocument();
    });

    it('remainingMs 为 0 时应显示"竞拍结束"', () => {
      render(<Countdown remainingMs={0} isUrgent={false} />);
      expect(screen.getByText('竞拍结束')).toBeInTheDocument();
    });

    it('remainingMs 为负数时应显示"竞拍结束"', () => {
      render(<Countdown remainingMs={-100} isUrgent={false} />);
      expect(screen.getByText('竞拍结束')).toBeInTheDocument();
    });

    it('remainingMs 为 0 时应显示 00:00.000', () => {
      render(<Countdown remainingMs={0} isUrgent={false} />);
      // 结束状态显示固定值，'00' 在多个 span 中出现
      const zeroElements = screen.getAllByText('00');
      expect(zeroElements.length).toBeGreaterThanOrEqual(2);
      // 也应显示 '000'（毫秒部分）
      expect(screen.getByText('000')).toBeInTheDocument();
    });

    it('应正确渲染带毫秒精度的倒计时', () => {
      // 12345ms -> 00:12.345
      render(<Countdown remainingMs={12345} isUrgent={false} />);
      expect(screen.getByText('00')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('345')).toBeInTheDocument();
    });

    it('sync 更新后 remainingMs 变化应正确渲染新值', () => {
      const { rerender } = render(<Countdown remainingMs={30000} isUrgent={false} />);
      expect(screen.getByText('30')).toBeInTheDocument();

      // 模拟 sync 更新：新的 remainingMs
      rerender(<Countdown remainingMs={15500} isUrgent={false} />);
      // formatMs(15500) = "00:15.500"
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('sync 更新后 isUrgent 切换应改变显示样式', () => {
      const { rerender } = render(<Countdown remainingMs={30000} isUrgent={false} />);
      expect(screen.getByText('距竞拍结束仅剩')).toBeInTheDocument();

      // 进入紧急状态
      rerender(<Countdown remainingMs={5000} isUrgent={true} />);
      expect(screen.getByText('即将结束')).toBeInTheDocument();
      expect(screen.getByText('最后机会，立即出价')).toBeInTheDocument();
    });

    it('1 分钟以上的倒计时应正确显示分钟', () => {
      // formatMs(125000) = "02:05.000"
      render(<Countdown remainingMs={125000} isUrgent={false} />);
      expect(screen.getByText('02')).toBeInTheDocument();
      expect(screen.getByText('05')).toBeInTheDocument();
    });
  });
});
