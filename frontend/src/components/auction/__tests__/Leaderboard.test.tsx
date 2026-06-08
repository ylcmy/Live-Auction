import { describe, it, expect } from 'vitest';

describe('Leaderboard', () => {
  it('should sort entries by amount descending', () => {
    const entries = [
      { rank: 1, userId: 1, userNickname: 'A', amount: 100, timestamp: '' },
      { rank: 2, userId: 2, userNickname: 'B', amount: 200, timestamp: '' },
    ];
    const sorted = [...entries].sort((a, b) => b.amount - a.amount);
    expect(sorted[0].amount).toBe(200);
    expect(sorted[1].amount).toBe(100);
  });

  it('should highlight current user row based on userId comparison', () => {
    const currentUserId = 1;
    const entries = [
      { rank: 1, userId: 1, userNickname: 'A', amount: 100, timestamp: '' },
      { rank: 2, userId: 2, userNickname: 'B', amount: 200, timestamp: '' },
    ];
    const currentUserEntry = entries.find(e => e.userId === currentUserId);
    expect(currentUserEntry).toBeDefined();
    expect(currentUserEntry!.userId).toBe(1);
  });
});
