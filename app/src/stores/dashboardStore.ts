import { create } from 'zustand';
import api from '@/lib/api';
import type { DashboardStats, LearningTrendData, AbilityRadarData, Activity, ModulesData } from '@/types';

interface DashboardState {
  stats: DashboardStats | null;
  learningTrend: LearningTrendData | null;
  abilityRadar: AbilityRadarData | null;
  recentActivities: Activity[];
  modules: ModulesData | null;
  isLoading: boolean;
  fetchStats: () => Promise<void>;
  fetchLearningTrend: () => Promise<void>;
  fetchAbilityRadar: () => Promise<void>;
  fetchRecentActivities: () => Promise<void>;
  fetchModules: () => Promise<void>;
  exportReport: () => Promise<void>;
}

// Track in-flight requests to prevent duplicate concurrent calls
const pendingRequests: Record<string, Promise<void>> = {};

function dedup(key: string, fn: () => Promise<void>): Promise<void> {
  if (key in pendingRequests) return pendingRequests[key];
  const promise = fn().finally(() => { delete pendingRequests[key]; });
  pendingRequests[key] = promise;
  return promise;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  learningTrend: null,
  abilityRadar: null,
  recentActivities: [],
  modules: null,
  isLoading: false,

  fetchStats: () => dedup('stats', async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/dashboard/student/stats');
      set({ stats: data });
    } catch (error) {
      console.error('获取仪表盘统计失败:', error);
    } finally {
      set({ isLoading: false });
    }
  }),

  fetchLearningTrend: () => dedup('trend', async () => {
    try {
      const { data } = await api.get('/dashboard/student/trend');
      set({ learningTrend: data });
    } catch (error) {
      console.error('获取学习趋势失败:', error);
    }
  }),

  fetchAbilityRadar: () => dedup('radar', async () => {
    try {
      const { data } = await api.get('/dashboard/student/radar');
      set({ abilityRadar: data });
    } catch (error) {
      console.error('获取能力雷达失败:', error);
    }
  }),

  fetchRecentActivities: () => dedup('activities', async () => {
    try {
      const { data } = await api.get('/dashboard/student/activities');
      set({ recentActivities: data });
    } catch (error) {
      console.error('获取最近活动失败:', error);
    }
  }),

  fetchModules: () => dedup('modules', async () => {
    try {
      const { data } = await api.get('/dashboard/student/modules');
      set({ modules: data });
    } catch (error) {
      console.error('获取学习模块失败:', error);
    }
  }),

  exportReport: async () => {
    try {
      const response = await api.get('/dashboard/student/report/export', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'text/csv' });
      const url = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header or use default
      const disposition = response.headers['content-disposition'] || '';
      let filename = `学习报告_${new Date().toISOString().slice(0, 10)}.csv`;
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      if (match) {
        filename = decodeURIComponent(match[1]);
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('导出报告失败:', error);
    }
  },
}));
