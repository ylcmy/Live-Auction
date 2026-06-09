import { describe, test, expect, beforeEach } from 'vitest';
import { useAuctionStore } from '../auctionStore';
import type { AuctionState, LeaderboardEntry, ChatMessage } from '@/types/ws';
import type { RoomAuctionItem } from '@/types/api';
import {
  mockAuctionState,
  mockLeaderboard,
  mockCountdownSync,
  mockEmotionEvent,
  mockChatMessage,
  mockMyBids,
  mockRoomAuctions,
  mockRoomAuctionItem,
  mockListedAuction,
  mockEndedAuction,
} from '@/tests/fixtures/auction';

const initialState = {
  currentAuction: null,
  leaderboard: [],
  countdown: null,
  extendMs: null,
  myRank: null,
  emotionEvents: [],
  participantCount: 0,
  onlineCount: 0,
  myBids: {},
  roomAuctions: [],
  chatMessages: [],
};

describe('auctionStore', () => {
  beforeEach(() => {
    useAuctionStore.setState(initialState);
  });

  describe('初始状态', () => {
    test('所有字段都有正确的默认值', () => {
      const state = useAuctionStore.getState();
      expect(state.currentAuction).toBeNull();
      expect(state.leaderboard).toEqual([]);
      expect(state.countdown).toBeNull();
      expect(state.extendMs).toBeNull();
      expect(state.myRank).toBeNull();
      expect(state.emotionEvents).toEqual([]);
      expect(state.participantCount).toBe(0);
      expect(state.onlineCount).toBe(0);
      expect(state.myBids).toEqual({});
      expect(state.roomAuctions).toEqual([]);
      expect(state.chatMessages).toEqual([]);
    });
  });

  describe('setAuction', () => {
    test('设置 currentAuction', () => {
      useAuctionStore.getState().setAuction(mockAuctionState);

      expect(useAuctionStore.getState().currentAuction).toEqual(mockAuctionState);
    });

    test('同步设置 leaderboard', () => {
      useAuctionStore.getState().setAuction(mockAuctionState);

      expect(useAuctionStore.getState().leaderboard).toEqual(mockAuctionState.leaderboard);
    });

    test('同步设置 participantCount', () => {
      useAuctionStore.getState().setAuction(mockAuctionState);

      expect(useAuctionStore.getState().participantCount).toBe(mockAuctionState.participantCount);
    });

    test('当 remainingMs 有值时设置 countdown', () => {
      useAuctionStore.getState().setAuction(mockAuctionState);

      const countdown = useAuctionStore.getState().countdown;
      expect(countdown).not.toBeNull();
      expect(countdown!.sessionId).toBe(mockAuctionState.sessionId);
      expect(countdown!.remainingMs).toBe(mockAuctionState.remainingMs);
    });

    test('当 remainingMs 为 null 时 countdown 为 null', () => {
      const auctionWithoutRemaining: AuctionState = {
        ...mockAuctionState,
        remainingMs: null as unknown as number,
      };

      useAuctionStore.getState().setAuction(auctionWithoutRemaining);

      expect(useAuctionStore.getState().countdown).toBeNull();
    });
  });

  describe('setLeaderboard', () => {
    test('设置排行榜数据', () => {
      useAuctionStore.getState().setLeaderboard(mockLeaderboard);

      expect(useAuctionStore.getState().leaderboard).toEqual(mockLeaderboard);
      expect(useAuctionStore.getState().leaderboard).toHaveLength(3);
    });

    test('替换之前的排行榜数据', () => {
      useAuctionStore.getState().setLeaderboard(mockLeaderboard);

      const newLeaderboard: LeaderboardEntry[] = [
        { rank: 1, userId: 99, userNickname: '新用户', avatarUrl: null, amount: 500, timestamp: new Date().toISOString(), isCurrentUser: true },
      ];
      useAuctionStore.getState().setLeaderboard(newLeaderboard);

      expect(useAuctionStore.getState().leaderboard).toEqual(newLeaderboard);
      expect(useAuctionStore.getState().leaderboard).toHaveLength(1);
    });
  });

  describe('setCountdown', () => {
    test('设置倒计时同步数据', () => {
      useAuctionStore.getState().setCountdown(mockCountdownSync);

      expect(useAuctionStore.getState().countdown).toEqual(mockCountdownSync);
    });

    test('替换之前的倒计时数据', () => {
      useAuctionStore.getState().setCountdown(mockCountdownSync);

      const newCountdown = { sessionId: 2, remainingMs: 10000, serverTime: Date.now() };
      useAuctionStore.getState().setCountdown(newCountdown);

      expect(useAuctionStore.getState().countdown).toEqual(newCountdown);
    });
  });

  describe('triggerExtend', () => {
    test('设置延时毫秒数', () => {
      useAuctionStore.getState().triggerExtend(5000);

      expect(useAuctionStore.getState().extendMs).toBe(5000);
    });

    test('覆盖之前的延时值', () => {
      useAuctionStore.getState().triggerExtend(5000);
      useAuctionStore.getState().triggerExtend(10000);

      expect(useAuctionStore.getState().extendMs).toBe(10000);
    });
  });

  describe('setMyRank', () => {
    test('从竞价结果中设置 myRank', () => {
      useAuctionStore.getState().setMyRank({
        sessionId: 1,
        bidId: 101,
        amount: 200,
        rank: 1,
        isLeading: true,
        gapToLeader: 0,
      });

      expect(useAuctionStore.getState().myRank).toBe(1);
    });

    test('更新排名为非第一名', () => {
      useAuctionStore.getState().setMyRank({
        sessionId: 1,
        bidId: 102,
        amount: 150,
        rank: 3,
        isLeading: false,
        gapToLeader: 50,
      });

      expect(useAuctionStore.getState().myRank).toBe(3);
    });
  });

  describe('setEmotion / removeEmotion', () => {
    test('设置情感事件', () => {
      useAuctionStore.getState().setEmotion(mockEmotionEvent);

      const events = useAuctionStore.getState().emotionEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject(mockEmotionEvent);
      expect(events[0].id).toBeDefined();
    });

    test('清除情感事件', () => {
      useAuctionStore.getState().setEmotion(mockEmotionEvent);
      const events = useAuctionStore.getState().emotionEvents;
      expect(events).toHaveLength(1);

      useAuctionStore.getState().removeEmotion(events[0].id!);

      expect(useAuctionStore.getState().emotionEvents).toHaveLength(0);
    });
  });

  describe('setParticipantCount', () => {
    test('设置参与人数', () => {
      useAuctionStore.getState().setParticipantCount(42);

      expect(useAuctionStore.getState().participantCount).toBe(42);
    });
  });

  describe('setOnlineCount', () => {
    test('设置在线人数', () => {
      useAuctionStore.getState().setOnlineCount(100);

      expect(useAuctionStore.getState().onlineCount).toBe(100);
    });
  });

  describe('setMyBid', () => {
    test('记录指定 session 的出价', () => {
      useAuctionStore.getState().setMyBid(1, 200);

      expect(useAuctionStore.getState().myBids[1]).toBe(200);
    });

    test('累积多个 session 的出价', () => {
      useAuctionStore.getState().setMyBid(1, 200);
      useAuctionStore.getState().setMyBid(2, 150);

      expect(useAuctionStore.getState().myBids).toEqual({ 1: 200, 2: 150 });
    });

    test('更新已有 session 的出价', () => {
      useAuctionStore.getState().setMyBid(1, 200);
      useAuctionStore.getState().setMyBid(1, 300);

      expect(useAuctionStore.getState().myBids[1]).toBe(300);
    });
  });

  describe('setRoomAuctions', () => {
    test('直接设置房间竞拍列表', () => {
      useAuctionStore.getState().setRoomAuctions(mockRoomAuctions);

      expect(useAuctionStore.getState().roomAuctions).toEqual(mockRoomAuctions);
      expect(useAuctionStore.getState().roomAuctions).toHaveLength(3);
    });

    test('支持函数式更新', () => {
      useAuctionStore.getState().setRoomAuctions([mockRoomAuctionItem]);
      useAuctionStore.getState().setRoomAuctions((prev) => [...prev, mockListedAuction]);

      const auctions = useAuctionStore.getState().roomAuctions;
      expect(auctions).toHaveLength(2);
      expect(auctions[0].sessionId).toBe(mockRoomAuctionItem.sessionId);
      expect(auctions[1].sessionId).toBe(mockListedAuction.sessionId);
    });
  });

  describe('updateAuctionPrice', () => {
    beforeEach(() => {
      useAuctionStore.setState({
        roomAuctions: [...mockRoomAuctions],
        currentAuction: { ...mockAuctionState },
      });
    });

    test('更新 roomAuctions 中匹配 session 的价格', () => {
      useAuctionStore.getState().updateAuctionPrice(1, 999);

      const updated = useAuctionStore.getState().roomAuctions.find((a) => a.sessionId === 1);
      expect(updated!.currentPrice).toBe(999);
    });

    test('不影响其他 session 的价格', () => {
      useAuctionStore.getState().updateAuctionPrice(1, 999);

      const other = useAuctionStore.getState().roomAuctions.find((a) => a.sessionId === 2);
      expect(other!.currentPrice).toBe(0); // 原始值不变
    });

    test('当 sessionId 匹配 currentAuction 时同步更新价格', () => {
      useAuctionStore.getState().updateAuctionPrice(1, 999);

      expect(useAuctionStore.getState().currentAuction!.currentPrice).toBe(999);
    });

    test('当 sessionId 不匹配 currentAuction 时不影响 currentAuction', () => {
      useAuctionStore.getState().updateAuctionPrice(2, 999);

      expect(useAuctionStore.getState().currentAuction!.currentPrice).toBe(100); // 原始值
    });
  });

  describe('updateAuctionStatus', () => {
    beforeEach(() => {
      useAuctionStore.setState({
        roomAuctions: [...mockRoomAuctions],
        currentAuction: { ...mockAuctionState },
      });
    });

    test('更新 roomAuctions 中已有 session 的状态', () => {
      useAuctionStore.getState().updateAuctionStatus(1, 'ended');

      const updated = useAuctionStore.getState().roomAuctions.find((a) => a.sessionId === 1);
      expect(updated!.status).toBe('ended');
    });

    test('同步更新 currentAuction 的状态', () => {
      useAuctionStore.getState().updateAuctionStatus(1, 'ended');

      expect(useAuctionStore.getState().currentAuction!.status).toBe('ended');
    });

    test('当 session 不存在于 roomAuctions 时创建新条目', () => {
      const newSessionId = 999;
      useAuctionStore.getState().updateAuctionStatus(newSessionId, 'active');

      const auctions = useAuctionStore.getState().roomAuctions;
      const newEntry = auctions.find((a) => a.sessionId === newSessionId);

      expect(newEntry).toBeDefined();
      expect(newEntry!.status).toBe('active');
      expect(newEntry!.currentPrice).toBe(0);
      expect(auctions).toHaveLength(mockRoomAuctions.length + 1);
    });

    test('当 session 不存在且 currentAuction 匹配时也更新 currentAuction', () => {
      useAuctionStore.setState({
        roomAuctions: [],
        currentAuction: { ...mockAuctionState, sessionId: 999 },
      });

      useAuctionStore.getState().updateAuctionStatus(999, 'ended');

      expect(useAuctionStore.getState().currentAuction!.status).toBe('ended');
    });
  });

  describe('clearAuction', () => {
    test('重置所有字段为初始值', () => {
      // 先填充状态
      useAuctionStore.setState({
        currentAuction: mockAuctionState,
        leaderboard: mockLeaderboard,
        countdown: mockCountdownSync,
        extendMs: 5000,
        myRank: 1,
        emotionEvents: [{ ...mockEmotionEvent, id: 'test-id' }],
        participantCount: 5,
        onlineCount: 42,
        myBids: mockMyBids,
        roomAuctions: mockRoomAuctions,
        chatMessages: [mockChatMessage],
      });

      useAuctionStore.getState().clearAuction();

      const state = useAuctionStore.getState();
      expect(state.currentAuction).toBeNull();
      expect(state.leaderboard).toEqual([]);
      expect(state.countdown).toBeNull();
      expect(state.extendMs).toBeNull();
      expect(state.myRank).toBeNull();
      expect(state.emotionEvents).toEqual([]);
      expect(state.participantCount).toBe(0);
      expect(state.myBids).toEqual({});
      expect(state.roomAuctions).toEqual([]);
      expect(state.chatMessages).toEqual([]);
    });
  });

  describe('addChatMessage', () => {
    test('添加聊天消息', () => {
      useAuctionStore.getState().addChatMessage(mockChatMessage);

      expect(useAuctionStore.getState().chatMessages).toEqual([mockChatMessage]);
    });

    test('按顺序累积消息', () => {
      const msg1: ChatMessage = { ...mockChatMessage, content: '消息1' };
      const msg2: ChatMessage = { ...mockChatMessage, content: '消息2' };

      useAuctionStore.getState().addChatMessage(msg1);
      useAuctionStore.getState().addChatMessage(msg2);

      const messages = useAuctionStore.getState().chatMessages;
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('消息1');
      expect(messages[1].content).toBe('消息2');
    });

    test('最多保留 100 条消息', () => {
      // 先添加 99 条
      const existing: ChatMessage[] = Array.from({ length: 99 }, (_, i) => ({
        ...mockChatMessage,
        content: `existing-${i}`,
      }));
      useAuctionStore.setState({ chatMessages: existing });

      // 添加第 100 条
      const newMsg: ChatMessage = { ...mockChatMessage, content: 'newest' };
      useAuctionStore.getState().addChatMessage(newMsg);

      const messages = useAuctionStore.getState().chatMessages;
      expect(messages).toHaveLength(100);
      expect(messages[99].content).toBe('newest');
    });

    test('超过 100 条时丢弃最早的消息', () => {
      // 先添加 100 条
      const existing: ChatMessage[] = Array.from({ length: 100 }, (_, i) => ({
        ...mockChatMessage,
        content: `msg-${i}`,
      }));
      useAuctionStore.setState({ chatMessages: existing });

      // 添加第 101 条
      const overflow: ChatMessage = { ...mockChatMessage, content: 'overflow' };
      useAuctionStore.getState().addChatMessage(overflow);

      const messages = useAuctionStore.getState().chatMessages;
      expect(messages).toHaveLength(100);
      expect(messages[0].content).toBe('msg-1'); // 最早的 msg-0 被丢弃
      expect(messages[99].content).toBe('overflow');
    });
  });

  describe('排名/差距实时更新', () => {
    test('setMyRank 应更新 myRank', () => {
      useAuctionStore.getState().setMyRank({
        sessionId: 1,
        bidId: 101,
        amount: 200,
        rank: 1,
        isLeading: true,
        gapToLeader: 0,
      });

      expect(useAuctionStore.getState().myRank).toBe(1);
    });

    test('连续多次 setMyRank 应反映最新排名', () => {
      useAuctionStore.getState().setMyRank({
        sessionId: 1,
        bidId: 101,
        amount: 200,
        rank: 1,
        isLeading: true,
        gapToLeader: 0,
      });

      useAuctionStore.getState().setMyRank({
        sessionId: 1,
        bidId: 102,
        amount: 180,
        rank: 3,
        isLeading: false,
        gapToLeader: 50,
      });

      expect(useAuctionStore.getState().myRank).toBe(3);
    });

    test('setAuction 应同步设置 myRank（当 AuctionState 包含 myRank）', () => {
      const auctionWithRank: AuctionState = {
        ...mockAuctionState,
        myRank: 2,
      };

      useAuctionStore.getState().setAuction(auctionWithRank);

      expect(useAuctionStore.getState().myRank).toBe(2);
    });

    test('setAuction 的 myRank 为 null 时保留之前的状态', () => {
      // 先设为 rank 1
      useAuctionStore.getState().setMyRank({
        sessionId: 1,
        bidId: 101,
        amount: 200,
        rank: 1,
        isLeading: true,
        gapToLeader: 0,
      });

      const auctionWithoutRank: AuctionState = {
        ...mockAuctionState,
        myRank: null,
      };

      useAuctionStore.getState().setAuction(auctionWithoutRank);

      // myRank 应保持不变（setAuction 中 myRank ?? state.myRank）
      expect(useAuctionStore.getState().myRank).toBe(1);
    });

    test('setLeaderboard 应正确更新排行榜排名', () => {
      useAuctionStore.getState().setLeaderboard(mockLeaderboard);

      expect(useAuctionStore.getState().leaderboard).toHaveLength(3);
      expect(useAuctionStore.getState().leaderboard[0].rank).toBe(1);
      expect(useAuctionStore.getState().leaderboard[0].amount).toBe(200);
    });

    test('setLeaderboard 替换后排名应从新数据获取', () => {
      useAuctionStore.getState().setLeaderboard(mockLeaderboard);

      const newLeaderboard: LeaderboardEntry[] = [
        { rank: 1, userId: 5, userNickname: '新用户', avatarUrl: null, amount: 500, timestamp: new Date().toISOString(), isCurrentUser: true },
        { rank: 2, userId: 1, userNickname: '用户A', avatarUrl: null, amount: 400, timestamp: new Date().toISOString(), isCurrentUser: false },
      ];

      useAuctionStore.getState().setLeaderboard(newLeaderboard);

      expect(useAuctionStore.getState().leaderboard).toHaveLength(2);
      expect(useAuctionStore.getState().leaderboard[0].amount).toBe(500);
    });
  });

  describe('50 次事件无长任务 >50ms', () => {
    test('连续 50 次 setLeaderboard 更新耗时不超过 50ms', () => {
      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const entries: LeaderboardEntry[] = Array.from({ length: 10 }, (_, j) => ({
          rank: j + 1,
          userId: j + 1,
          userNickname: `用户${j + 1}`,
          avatarUrl: null,
          amount: 1000 - j * 50 + i,
          timestamp: new Date().toISOString(),
          isCurrentUser: j === 0,
        }));
        useAuctionStore.getState().setLeaderboard(entries);
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    test('连续 50 次 updateAuctionPrice 更新耗时不超过 50ms', () => {
      useAuctionStore.setState({
        roomAuctions: [...mockRoomAuctions],
        currentAuction: { ...mockAuctionState },
      });

      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        useAuctionStore.getState().updateAuctionPrice(1, 100 + i * 10);
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    test('连续 50 次 setMyRank 更新耗时不超过 50ms', () => {
      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        useAuctionStore.getState().setMyRank({
          sessionId: 1,
          bidId: 100 + i,
          amount: 200 + i * 5,
          rank: (i % 5) + 1,
          isLeading: i % 5 === 0,
          gapToLeader: i % 5 === 0 ? 0 : 10 * (i % 5),
        });
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    test('连续 50 次 addChatMessage 更新耗时不超过 50ms', () => {
      useAuctionStore.setState({ chatMessages: [] });
      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        useAuctionStore.getState().addChatMessage({
          ...mockChatMessage,
          content: `msg-${i}`,
        });
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    test('混合 50 次事件（排行+出价+聊天）耗时不超过 50ms', () => {
      useAuctionStore.setState({
        roomAuctions: [...mockRoomAuctions],
        currentAuction: { ...mockAuctionState },
        chatMessages: [],
      });

      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        // 排行更新
        const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, j) => ({
          rank: j + 1,
          userId: j + 1,
          userNickname: `用户${j + 1}`,
          avatarUrl: null,
          amount: 500 - j * 50 + i,
          timestamp: new Date().toISOString(),
          isCurrentUser: false,
        }));
        useAuctionStore.getState().setLeaderboard(entries);

        // 出价结果
        useAuctionStore.getState().setMyRank({
          sessionId: 1,
          bidId: 200 + i,
          amount: 200 + i * 10,
          rank: (i % 3) + 1,
          isLeading: i % 3 === 0,
          gapToLeader: i % 3 === 0 ? 0 : 20,
        });

        // 聊天消息
        useAuctionStore.getState().addChatMessage({
          ...mockChatMessage,
          content: `mixed-${i}`,
        });
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});
