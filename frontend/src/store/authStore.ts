import { create } from 'zustand';
import api from '../services/api';
import { decodeJwtPayload } from '../lib/jwt';
import type { User } from '../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string, role: 'merchant' | 'user') => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  clearError: () => void;
}

// Restore user from JWT on page reload so auction-result comparison
// (`result.winner.userId === user.id`) works after a refresh.
function restoreUserFromToken(): User | null {
  const t = localStorage.getItem('accessToken');
  if (!t) return null;
  const payload = decodeJwtPayload<{ userId?: number; sub?: number; role?: string; nickname?: string }>(t);
  if (!payload) return null;
  const userId = payload.userId ?? payload.sub;
  if (userId == null) return null;
  return {
    id: userId,
    username: '',
    role: (payload.role as User['role']) || 'user',
    nickname: payload.nickname || '',
    avatarUrl: null,
  } as User;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: restoreUserFromToken(),
  token: localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response: any = await api.post('/auth/login', { username, password });
      const { accessToken, refreshToken } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      // Decode user from token
      const payload = decodeJwtPayload<{ userId: number; role: string; nickname: string }>(accessToken);
      if (!payload) throw new Error('Invalid token');
      set({
        user: {
          id: payload.userId,
          username,
          role: payload.role,
          nickname: payload.nickname || '',
          avatarUrl: null,
        } as User,
        token: accessToken,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err?.data?.message || err.message || '登录失败',
        isLoading: false,
      });
    }
  },

  register: async (username, password, nickname, role) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/auth/register', { username, password, nickname, role });
      set({ isLoading: false });
    } catch (err: any) {
      set({
        error: err?.data?.message || err.message || '注册失败',
        isLoading: false,
      });
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, error: null });
  },

  setUser: (user) => set({ user }),

  clearError: () => set({ error: null }),
}));
