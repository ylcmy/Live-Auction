import { create } from 'zustand';
import { api } from '../services/api';
export const useAuthStore = create((set) => ({
    user: null,
    token: localStorage.getItem('accessToken'),
    isLoading: false,
    error: null,
    login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/auth/login', { username, password });
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
                },
                token: accessToken,
                isLoading: false,
            });
        }
        catch (err) {
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
        }
        catch (err) {
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
