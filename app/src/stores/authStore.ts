import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { API_URL } from '@/lib/api';
import { clearSessionCookie } from '@/lib/session';
import type { User } from '@/types';

/** fetch + json 解析封装：将网络错误、解析错误转为友好提示 */
async function safeFetchJson(input: RequestInfo, init?: RequestInit): Promise<{ ok: boolean; data: any }> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    console.error('Network error:', err);
    throw new Error('网络连接失败，请检查网络后重试');
  }
  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    console.error('JSON parse error:', err);
    throw new Error('服务器响应异常，请稍后再试');
  }
  return { ok: response.ok, data };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  rememberMe: boolean;
  
  // 认证方法
  login: (email: string, password?: string, code?: string) => Promise<void>;
  register: (email: string, code: string, password: string, name: string, role: 'STUDENT' | 'TEACHER') => Promise<void>;
  logout: () => void;
  setRememberMe: (value: boolean) => void;
  sendVerifyCode: (email: string, type: 'register' | 'login' | 'reset') => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  updateProfile: (data: { name?: string; avatar?: string | null; bio?: string | null }) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      rememberMe: true,

      setRememberMe: (value: boolean) => set({ rememberMe: value }),

      // 发送验证码
      sendVerifyCode: async (email: string, type: 'register' | 'login' | 'reset') => {
        const { ok, data } = await safeFetchJson(`${API_URL}/auth/send-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type }),
        });

        if (!ok) {
          throw new Error(data.error || '发送验证码失败');
        }
      },

      // 登录
      login: async (email: string, password?: string, code?: string) => {
        const { ok, data } = await safeFetchJson(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, code }),
        });

        if (!ok) {
          throw new Error(data.error || '登录失败');
        }

        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });
      },

      // 注册
      register: async (email: string, code: string, password: string, name: string, role: 'STUDENT' | 'TEACHER') => {
        const { ok, data } = await safeFetchJson(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, password, name, role }),
        });

        if (!ok) {
          throw new Error(data.error || '注册失败');
        }

        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });
      },

      // 重置密码
      resetPassword: async (email: string, code: string, newPassword: string) => {
        const { ok, data } = await safeFetchJson(`${API_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, newPassword }),
        });

        if (!ok) {
          throw new Error(data.error || '重置密码失败');
        }
      },

      // 获取当前用户信息
      fetchUser: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.user });
        } catch {
          // Token 无效，登出并跳转到登录页
          get().logout();
          window.location.href = '/login';
        }
      },

      // 更新用户资料
      updateProfile: async (data: { name?: string; avatar?: string | null; bio?: string | null }) => {
        const { data: result } = await api.put('/auth/profile', data);
        set({ user: result.user });
      },

      // 更新密码
      updatePassword: async (currentPassword: string, newPassword: string) => {
        await api.put('/auth/password', { currentPassword, newPassword });
      },

      // 登出
      logout: () => {
        clearSessionCookie();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          rememberMe: true,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, isAuthenticated: state.isAuthenticated, user: state.user, rememberMe: state.rememberMe }),
    }
  )
);
