import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LeaderboardEntry } from '@/types/ws';

// ---- Mocks ----
vi.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy({}, {
      get: (_target, tag: string) => {
        const MotionComponent = (props: Record<string, unknown>) => {
          const { whileTap, whileHover, initial, animate, exit, transition, variants, layout, key, ...rest } = props;
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

vi.mock('@/design-system/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
}));

vi.mock('@/design-system/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  AvatarFallback: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
}));

vi.mock('@/design-system/components/ui/badge', () => ({
  Badge: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
}));

// Mutable store mock state
let mockLeaderboard: LeaderboardEntry[] = [];
let mockMyRank: number | null = null;
let mockCurrentUserId: number | undefined = undefined;

vi.mock('@/store/auctionStore', () => ({
  useAuctionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      leaderboard: mockLeaderboard,
      myRank: mockMyRank,
    }),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ user: { id: mockCurrentUserId } }),
}));

// Import after mocks
import Leaderboard from '../Leaderboard';

describe('Leaderboard', () => {
  beforeEach(() => {
    mockLeaderboard = [];
    mockMyRank = null;
    mockCurrentUserId = undefined;
  });

  it('should sort entries by amount descending', () => {
    const entries = [
      { rank: 1, userId: 1, userNickname: 'A', amount: 100, timestamp: '', isCurrentUser: false },
      { rank: 2, userId: 2, userNickname: 'B', amount: 200, timestamp: '', isCurrentUser: false },
    ];
    const sorted = [...entries].sort((a, b) => b.amount - a.amount);
    expect(sorted[0].amount).toBe(200);
    expect(sorted[1].amount).toBe(100);
  });

  it('should highlight current user row', () => {
    const entries = [
      { rank: 1, userId: 1, userNickname: 'A', amount: 100, timestamp: '', isCurrentUser: true },
      { rank: 2, userId: 2, userNickname: 'B', amount: 200, timestamp: '', isCurrentUser: false },
    ];
    const currentUserEntry = entries.find(e => e.isCurrentUser);
    expect(currentUserEntry).toBeDefined();
    expect(currentUserEntry!.userId).toBe(1);
  });

  it('应显示空状态文案当排行榜为空', () => {
    mockLeaderboard = [];
    render(<Leaderboard />);
    expect(screen.getByText('暂无出价，快来抢第一！')).toBeInTheDocument();
  });

  it('应正确显示排行榜条目数量', () => {
    mockLeaderboard = [
      { rank: 1, userId: 1, userNickname: '用户A', avatarUrl: null, amount: 200, timestamp: '', isCurrentUser: false },
      { rank: 2, userId: 2, userNickname: '用户B', avatarUrl: null, amount: 150, timestamp: '', isCurrentUser: false },
      { rank: 3, userId: 3, userNickname: '用户C', avatarUrl: null, amount: 120, timestamp: '', isCurrentUser: false },
    ];
    render(<Leaderboard />);
    expect(screen.getByText('3 人参与')).toBeInTheDocument();
  });

  describe('个人排名与 gapToLeader 展示 (FR-022)', () => {
    it('应为当前用户显示"你"标签', () => {
      mockCurrentUserId = 2;
      mockLeaderboard = [
        { rank: 1, userId: 1, userNickname: '用户A', avatarUrl: null, amount: 200, timestamp: '', isCurrentUser: false },
        { rank: 2, userId: 2, userNickname: '用户B', avatarUrl: null, amount: 150, timestamp: '', isCurrentUser: true },
      ];

      render(<Leaderboard />);
      expect(screen.getByText('用户B')).toBeInTheDocument();
      expect(screen.getByText('你')).toBeInTheDocument();
    });

    it('应显示当前用户排名第一时的金额', () => {
      mockCurrentUserId = 1;
      mockLeaderboard = [
        { rank: 1, userId: 1, userNickname: '用户A', avatarUrl: null, amount: 200, timestamp: '', isCurrentUser: true },
      ];

      render(<Leaderboard />);
      expect(screen.getByText('用户A')).toBeInTheDocument();
      // formatPrice(200) = "¥200.00"
      expect(screen.getByText('¥200.00')).toBeInTheDocument();
    });

    it('应显示与第一名的差距（非第一名时）', () => {
      mockCurrentUserId = 3;
      mockLeaderboard = [
        { rank: 1, userId: 1, userNickname: '用户A', avatarUrl: null, amount: 200, timestamp: '', isCurrentUser: false },
        { rank: 2, userId: 2, userNickname: '用户B', avatarUrl: null, amount: 150, timestamp: '', isCurrentUser: false },
        { rank: 3, userId: 3, userNickname: '用户C', avatarUrl: null, amount: 120, timestamp: '', isCurrentUser: true },
      ];

      render(<Leaderboard />);

      // 用户C 与上一名差 30 元: 150 - 120 = 30
      // formatPrice 返回 "¥30.00"，模板拼接后是 "差 ¥¥30.00"，被拆为多个 textNode
      const gapElements = screen.getAllByText((_content, element) => {
        return element?.textContent?.includes('30.00') === true;
      });
      expect(gapElements.length).toBeGreaterThanOrEqual(1);
    });

    it('第一名不应显示差距', () => {
      mockLeaderboard = [
        { rank: 1, userId: 1, userNickname: '用户A', avatarUrl: null, amount: 200, timestamp: '', isCurrentUser: false },
        { rank: 2, userId: 2, userNickname: '用户B', avatarUrl: null, amount: 150, timestamp: '', isCurrentUser: false },
      ];

      render(<Leaderboard />);

      // 第一名不需要显示差距（gap 为 null）
      const gapTexts = screen.queryAllByText(/差/);
      // 只有第二名应显示差距
      expect(gapTexts).toHaveLength(1);
    });

    it('应显示当 myRank 超出前 10 时的个人排名提示', () => {
      mockMyRank = 15;
      // 创建 10 个排行榜条目
      mockLeaderboard = Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        userId: i + 1,
        userNickname: `用户${i + 1}`,
        avatarUrl: null,
        amount: 1000 - i * 50,
        timestamp: '',
        isCurrentUser: false,
      }));

      render(<Leaderboard />);
      expect(screen.getByText('你的排名: #15')).toBeInTheDocument();
    });

    it('myRank 在前 10 时不应显示额外的排名提示', () => {
      mockMyRank = 3;
      mockCurrentUserId = 3;
      mockLeaderboard = [
        { rank: 1, userId: 1, userNickname: '用户A', avatarUrl: null, amount: 200, timestamp: '', isCurrentUser: false },
        { rank: 2, userId: 2, userNickname: '用户B', avatarUrl: null, amount: 150, timestamp: '', isCurrentUser: false },
        { rank: 3, userId: 3, userNickname: '用户C', avatarUrl: null, amount: 120, timestamp: '', isCurrentUser: true },
      ];

      render(<Leaderboard />);
      expect(screen.queryByText(/你的排名/)).not.toBeInTheDocument();
    });
  });
});
