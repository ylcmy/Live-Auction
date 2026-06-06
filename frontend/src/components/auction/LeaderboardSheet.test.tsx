// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeaderboardSheet from './LeaderboardSheet';

vi.mock('../../store/auctionStore', () => ({
  useAuctionStore: (selector: any) => {
    const state = {
      leaderboard: [
        { rank: 1, userId: 1, userNickname: '出价王', avatarUrl: null, amount: 500, timestamp: '' },
      ],
      myRank: 1,
    };
    return selector(state);
  },
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: any) => selector({ user: { id: 1 } }),
}));

describe('LeaderboardSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <LeaderboardSheet open={false} onClose={() => {}} />
    );
    expect(container.textContent).toBe('');
  });

  it('shows title when open', () => {
    render(<LeaderboardSheet open={true} onClose={() => {}} />);
    expect(screen.getByText('出价排行榜')).toBeDefined();
  });
});
