import { create } from 'zustand';
import { api } from '../services/api';
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
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
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
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
    set({ user: null, token: null });
  },

  setUser: (user) => set({ user }),

  clearError: () => set({ error: null }),
}));
