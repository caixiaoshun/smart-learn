import axios from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * 全局 Axios 实例
 * - 请求拦截器：自动带上 Bearer Token
 * - 响应拦截器：401 自动登出并跳转登录页
 */
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：自动附加 Token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// HTTP 状态码 → 用户友好提示
function getFriendlyErrorMessage(status?: number): string {
  switch (status) {
    case 400: return '请求参数有误';
    case 403: return '没有权限执行此操作';
    case 404: return '请求的资源不存在';
    case 408: return '请求超时，请稍后再试';
    case 500: return '服务器内部错误，请稍后再试';
    case 502: return '服务器暂时不可用，请稍后再试';
    case 503: return '服务正在维护中，请稍后再试';
    default:  return '请求失败，请稍后再试';
  }
}

// 响应拦截器：统一处理错误与 Toast
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } else if (!error.config?.skipGlobalToast) {
      if (error.response?.status === 429) {
        toast.error('请求过于频繁，请稍后再试');
      } else {
        // 优先使用服务器返回的错误描述（仅 JSON 响应可用），否则按状态码给出友好提示
        const serverMessage = typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : null;
        toast.error(serverMessage || getFriendlyErrorMessage(error.response?.status));
      }
    }
    return Promise.reject(error);
  },
);

export default api;

/**
 * 带有 401 拦截的 fetch 封装（保留用于流式 SSE 请求）
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('认证已过期，请重新登录');
  }

  return response;
}
