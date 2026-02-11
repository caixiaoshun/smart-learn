import { create } from 'zustand';
import api from '@/lib/api';
import type { Case } from '@/types';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CaseFilters {
  category?: string;
  theme?: string;
  difficulty?: string;
  search?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

interface CaseState {
  cases: Case[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;

  fetchCases: (filters?: CaseFilters) => Promise<void>;
  fetchCaseDetail: (caseId: string) => Promise<Case>;
  createCase: (data: {
    title: string;
    description: string;
    content?: string;
    category: string;
    theme: string[];
    tags?: string[];
    difficulty?: string;
    duration?: number;
    codeExample?: string;
  }) => Promise<Case>;
  bookmarkCase: (caseId: string) => Promise<void>;
  unbookmarkCase: (caseId: string) => Promise<void>;
  checkBookmark: (caseId: string) => Promise<boolean>;
  fetchMyBookmarkIds: () => Promise<string[]>;
  rateCase: (caseId: string, rating: number) => Promise<void>;
  fetchComments: (caseId: string) => Promise<{ id: string; userId: string; username: string; avatar?: string; role?: string; content: string; createdAt: string }[]>;
  addComment: (caseId: string, content: string) => Promise<{ id: string; userId: string; username: string; avatar?: string; role?: string; content: string; createdAt: string }>;
  deleteComment: (caseId: string, commentId: string) => Promise<void>;
}

export const useCaseStore = create<CaseState>((set) => ({
  cases: [],
  pagination: null,
  isLoading: false,
  error: null,

  fetchCaseDetail: async (caseId: string) => {
    try {
      const { data } = await api.get(`/cases/${caseId}`);
      return {
        ...data.case,
        theme: Array.isArray(data.case.theme) ? data.case.theme : JSON.parse(data.case.theme || '[]'),
        tags: Array.isArray(data.case.tags) ? data.case.tags : JSON.parse(data.case.tags || '[]'),
      } as Case;
    } catch (error: any) {
      const message = error.response?.data?.error || '获取案例详情失败';
      throw new Error(message);
    }
  },

  fetchCases: async (filters?: CaseFilters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.theme) params.append('theme', filters.theme);
      if (filters?.difficulty) params.append('difficulty', filters.difficulty);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.order) params.append('order', filters.order);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.limit) params.append('limit', String(filters.limit));

      const { data } = await api.get(`/cases?${params.toString()}`);
      set({
        cases: data.cases,
        pagination: data.pagination,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || '获取案例列表失败';
      set({ error: message });
      console.error('获取案例列表失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createCase: async (caseData) => {
    try {
      const { data } = await api.post('/cases', caseData);
      // Refresh the case list after creation
      await useCaseStore.getState().fetchCases();
      return data.case;
    } catch (error: any) {
      const message = error.response?.data?.error || '创建案例失败';
      throw new Error(message);
    }
  },

  bookmarkCase: async (caseId: string) => {
    try {
      await api.post(`/cases/${caseId}/bookmark`);
    } catch (error: any) {
      const message = error.response?.data?.error || '收藏失败';
      throw new Error(message);
    }
  },

  unbookmarkCase: async (caseId: string) => {
    try {
      await api.delete(`/cases/${caseId}/bookmark`);
    } catch (error: any) {
      const message = error.response?.data?.error || '取消收藏失败';
      throw new Error(message);
    }
  },

  checkBookmark: async (caseId: string) => {
    try {
      const { data } = await api.get(`/cases/${caseId}/bookmark/check`);
      return data.isBookmarked;
    } catch {
      return false;
    }
  },

  fetchMyBookmarkIds: async () => {
    try {
      const { data } = await api.get('/cases/user/bookmarks');
      return (data.cases || []).map((c: { id: string }) => c.id);
    } catch {
      return [];
    }
  },

  rateCase: async (caseId: string, rating: number) => {
    try {
      await api.post(`/cases/${caseId}/rate`, { rating });
    } catch (error: any) {
      const message = error.response?.data?.error || '评分失败';
      throw new Error(message);
    }
  },

  fetchComments: async (caseId: string) => {
    try {
      const { data } = await api.get(`/cases/${caseId}/comments`);
      return data.comments;
    } catch (error: any) {
      const message = error.response?.data?.error || '获取评论失败';
      throw new Error(message);
    }
  },

  addComment: async (caseId: string, content: string) => {
    try {
      const { data } = await api.post(`/cases/${caseId}/comments`, { content });
      return data.comment;
    } catch (error: any) {
      const message = error.response?.data?.error || '发表评论失败';
      throw new Error(message);
    }
  },

  deleteComment: async (caseId: string, commentId: string) => {
    try {
      await api.delete(`/cases/${caseId}/comments/${commentId}`);
    } catch (error: any) {
      const message = error.response?.data?.error || '删除评论失败';
      throw new Error(message);
    }
  },
}));
