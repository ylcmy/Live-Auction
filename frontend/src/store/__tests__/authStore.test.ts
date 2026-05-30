import { describe, test, expect, beforeEach, vi } from 'vitest';
import { api } from '@/services/api';
import { useAuthStore } from '../authStore';
import type { User } from '@/types/api';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock('@/lib/jwt', () => ({
  decodeJwtPayload: vi.fn(),
}));

// 获取 mock 实例
const mockApiPost = vi.mocked(api.post);
const { decodeJwtPayload } = await import('@/lib/jwt');
const mockDecodeJwt = vi.mocked(decodeJwtPayload);

const mockUser: User = {
  id: 1,
  username: 'testuser',
  role: 'user',
  nickname: '测试用户',
  avatarUrl: null,
};

const loginPayload = {
  accessToken: 'access_token_123',
  refreshToken: 'refresh_token_456',
  expiresIn: 3600,
};

function setupLoginMocks() {
  mockDecodeJwt.mockReturnValue({
    userId: 1,
    role: 'user',
    nickname: '测试用户',
  });
  mockApiPost.mockResolvedValue({ data: loginPayload } as never);
}

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
    });
    mockApiPost.mockReset();
    mockDecodeJwt.mockReset();
  });

  describe('初始状态', () => {
    test('user 和 token 默认为 null', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    test('成功登录后设置 user 和 token', async () => {
      setupLoginMocks();

      await useAuthStore.getState().login('testuser', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('access_token_123');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    test('登录时 isLoading 先变为 true，完成后变为 false', async () => {
      setupLoginMocks();

      const loginPromise = useAuthStore.getState().login('testuser', 'password123');
      expect(useAuthStore.getState().isLoading).toBe(true);

      await loginPromise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    test('调用 api.post 发送正确的参数', async () => {
      setupLoginMocks();

      await useAuthStore.getState().login('testuser', 'password123');

      expect(mockApiPost).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'password123',
      });
    });

    test('登录成功后将 token 保存到 localStorage', async () => {
      setupLoginMocks();

      await useAuthStore.getState().login('testuser', 'password123');

      expect(localStorage.getItem('accessToken')).toBe('access_token_123');
      expect(localStorage.getItem('refreshToken')).toBe('refresh_token_456');
    });

    test('使用 decodeJwtPayload 解析 token 中的用户信息', async () => {
      setupLoginMocks();

      await useAuthStore.getState().login('testuser', 'password123');

      expect(mockDecodeJwt).toHaveBeenCalledWith('access_token_123');
    });

    test('当 token 解析失败时设置错误信息', async () => {
      mockApiPost.mockResolvedValue({ data: loginPayload } as never);
      mockDecodeJwt.mockReturnValue(null);

      await useAuthStore.getState().login('testuser', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.error).toBe('Invalid token');
      expect(state.isLoading).toBe(false);
    });

    test('api 请求失败时设置错误信息', async () => {
      mockApiPost.mockRejectedValue({
        data: { message: '用户名或密码错误' },
      });

      await useAuthStore.getState().login('testuser', 'wrong_password');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.error).toBe('用户名或密码错误');
      expect(state.isLoading).toBe(false);
    });

    test('api 请求失败且无 data.message 时使用默认错误信息', async () => {
      mockApiPost.mockRejectedValue(new Error('网络错误'));

      await useAuthStore.getState().login('testuser', 'password123');

      expect(useAuthStore.getState().error).toBe('网络错误');
    });

    test('api 请求失败且异常无 message 时使用兜底错误信息', async () => {
      mockApiPost.mockRejectedValue({});

      await useAuthStore.getState().login('testuser', 'password123');

      expect(useAuthStore.getState().error).toBe('登录失败');
    });
  });

  describe('register', () => {
    test('成功注册后 isLoading 恢复为 false', async () => {
      mockApiPost.mockResolvedValue({ data: null } as never);

      await useAuthStore.getState().register('newuser', 'password123', '新用户', 'user');

      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    test('注册时 isLoading 先变为 true', async () => {
      mockApiPost.mockResolvedValue({ data: null } as never);

      const registerPromise = useAuthStore.getState().register('newuser', 'password123', '新用户', 'user');
      expect(useAuthStore.getState().isLoading).toBe(true);

      await registerPromise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    test('调用 api.post 发送正确的参数', async () => {
      mockApiPost.mockResolvedValue({ data: null } as never);

      await useAuthStore.getState().register('newuser', 'password123', '新用户', 'merchant');

      expect(mockApiPost).toHaveBeenCalledWith('/auth/register', {
        username: 'newuser',
        password: 'password123',
        nickname: '新用户',
        role: 'merchant',
      });
    });

    test('注册成功后不设置 user 和 token', async () => {
      mockApiPost.mockResolvedValue({ data: null } as never);

      await useAuthStore.getState().register('newuser', 'password123', '新用户', 'user');

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().token).toBeNull();
    });

    test('注册失败时设置错误信息', async () => {
      mockApiPost.mockRejectedValue({
        data: { message: '用户名已存在' },
      });

      await useAuthStore.getState().register('existing', 'password123', '已存在', 'user');

      const state = useAuthStore.getState();
      expect(state.error).toBe('用户名已存在');
      expect(state.isLoading).toBe(false);
    });

    test('注册失败且无 data.message 时使用默认错误信息', async () => {
      mockApiPost.mockRejectedValue(new Error('网络错误'));

      await useAuthStore.getState().register('newuser', 'password123', '新用户', 'user');

      expect(useAuthStore.getState().error).toBe('网络错误');
    });

    test('注册失败且异常无 message 时使用兜底错误信息', async () => {
      mockApiPost.mockRejectedValue({});

      await useAuthStore.getState().register('newuser', 'password123', '新用户', 'user');

      expect(useAuthStore.getState().error).toBe('注册失败');
    });
  });

  describe('logout', () => {
    test('清除 localStorage 中的 token', () => {
      localStorage.setItem('accessToken', 'test_token');
      localStorage.setItem('refreshToken', 'test_refresh');

      useAuthStore.getState().logout();

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    test('重置 store 中的 user 和 token', () => {
      useAuthStore.setState({
        user: mockUser,
        token: 'test_token',
        error: 'some error',
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('setUser', () => {
    test('设置用户信息', () => {
      useAuthStore.getState().setUser(mockUser);

      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    test('替换已有的用户信息', () => {
      useAuthStore.setState({ user: mockUser });

      const updatedUser: User = { ...mockUser, nickname: '更新后的昵称' };
      useAuthStore.getState().setUser(updatedUser);

      expect(useAuthStore.getState().user!.nickname).toBe('更新后的昵称');
    });
  });

  describe('clearError', () => {
    test('清除错误信息', () => {
      useAuthStore.setState({ error: '一些错误' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });

    test('error 为 null 时调用 clearError 保持不变', () => {
      useAuthStore.setState({ error: null });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
