import { create } from 'zustand';
import api from '@/lib/api';

interface BehaviorLog {
  id: string;
  studentId: string;
  type: string;
  duration: number;
  metadata?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BehaviorState {
  logs: BehaviorLog[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;

  logBehavior: (type: string, duration?: number, metadata?: string) => Promise<void>;
  fetchMyLogs: (type?: string, page?: number) => Promise<void>;
}

export const useBehaviorStore = create<BehaviorState>((set) => ({
  logs: [],
  pagination: null,
  isLoading: false,
  error: null,

  logBehavior: async (type: string, duration = 0, metadata?: string) => {
    try {
      await api.post('/behavior', { type, duration, metadata });
    } catch (error: any) {
      console.error('记录行为日志失败:', error);
    }
  },

  fetchMyLogs: async (type?: string, page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      params.append('page', String(page));

      const { data } = await api.get(`/behavior/my?${params.toString()}`);
      set({
        logs: data.logs,
        pagination: data.pagination,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || '获取行为日志失败';
      set({ error: message });
      console.error('获取行为日志失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
