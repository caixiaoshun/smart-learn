import { create } from 'zustand';
import api from '@/lib/api';
import type { StudentBehavior, Intervention } from '@/types';

interface InterventionStats {
  warningCount: number;
  pendingInterventions: number;
  urgentCount: number;
  avgPoints: number;
  highPerformers: number;
}

interface TeacherState {
  students: StudentBehavior[];
  interventions: Intervention[];
  interventionStats: InterventionStats | null;
  classStats: {
    totalStudents: number;
    totalClasses: number;
    submissionRate: number;
    pendingAlerts: number;
  } | null;
  aiInsights: string | null;
  aiSuggestion: string | null;
  recentActivities: { id: string; title: string; time: string; type: string }[];
  upcomingTasks: { id: string; title: string; deadline: string; count: number | null }[];
  isGeneratingHomework: boolean;
  isLoadingDashboard: boolean;
  fetchStudents: () => Promise<void>;
  fetchInterventions: () => Promise<void>;
  fetchClassStats: () => Promise<void>;
  fetchAIInsights: () => Promise<void>;
  fetchAISuggestion: () => Promise<void>;
  fetchRecentActivities: () => Promise<void>;
  fetchUpcomingTasks: () => Promise<void>;
  generateAIHomework: (topic: string, classId: string) => Promise<void>;
}

export const useTeacherStore = create<TeacherState>((set) => ({
  students: [],
  interventions: [],
  interventionStats: null,
  classStats: null,
  aiInsights: null,
  aiSuggestion: null,
  recentActivities: [],
  upcomingTasks: [],
  isGeneratingHomework: false,
  isLoadingDashboard: false,

  fetchStudents: async () => {
    try {
      const { data } = await api.get('/behavior/teacher/students');
      set({ students: data.students });
    } catch (error) {
      console.error('获取学生行为数据失败:', error);
      set({ students: [] });
    }
  },

  fetchInterventions: async () => {
    try {
      const { data } = await api.get('/dashboard/teacher/intervention/data');
      set({
        interventions: data.interventions,
        interventionStats: data.stats,
        aiInsights: data.aiInsights,
      });
    } catch (error) {
      console.error('获取干预数据失败:', error);
    }
  },

  fetchClassStats: async () => {
    set({ isLoadingDashboard: true });
    try {
      const { data } = await api.get('/dashboard/teacher/stats');
      set({ classStats: data });
    } catch (error) {
      console.error('获取教师统计失败:', error);
    } finally {
      set({ isLoadingDashboard: false });
    }
  },

  fetchAIInsights: async () => {
    try {
      const { data } = await api.get('/dashboard/teacher/intervention/data');
      set({ aiInsights: data.aiInsights || null });
    } catch (error) {
      console.error('获取AI洞察失败:', error);
      set({ aiInsights: null });
    }
  },

  fetchAISuggestion: async () => {
    try {
      const { data } = await api.get('/dashboard/teacher/ai-suggestion');
      set({ aiSuggestion: data.suggestion });
    } catch (error) {
      console.error('获取AI教学建议失败:', error);
      set({ aiSuggestion: null });
    }
  },

  fetchRecentActivities: async () => {
    try {
      const { data } = await api.get('/dashboard/teacher/activities');
      set({ recentActivities: data });
    } catch (error) {
      console.error('获取教师动态失败:', error);
    }
  },

  fetchUpcomingTasks: async () => {
    try {
      const { data } = await api.get('/dashboard/teacher/tasks');
      set({ upcomingTasks: data });
    } catch (error) {
      console.error('获取教师待办失败:', error);
    }
  },

  generateAIHomework: async (topic: string, classId: string) => {
    set({ isGeneratingHomework: true });
    try {
      await api.post('/dashboard/teacher/intervention/ai-homework', { topic, classId });
    } finally {
      set({ isGeneratingHomework: false });
    }
  },
}));
