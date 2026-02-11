import { create } from 'zustand';
import api from '@/lib/api';
import type { Resource, Comment } from '@/types';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ResourceFilters {
  type?: string;
  category?: string;
  tag?: string;
  search?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

interface CreateResourceData {
  title: string;
  description: string;
  type: string;
  file?: File;
  tags?: string[];
  category?: string;
  duration?: string;
  points?: number;
}

interface CreateResourceFromHomeworkData {
  title: string;
  description: string;
  homeworkId: string;
  submissionId: string;
  fileKey: string;
  tags?: string[];
  category?: string;
}

interface ResourceState {
  resources: Resource[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;

  fetchResources: (filters?: ResourceFilters) => Promise<void>;
  loadMoreResources: (filters?: ResourceFilters) => Promise<void>;
  createResource: (data: CreateResourceData) => Promise<void>;
  createResourceFromHomework: (data: CreateResourceFromHomeworkData) => Promise<void>;
  fetchResourceDetail: (resourceId: string) => Promise<Resource>;
  previewResourceFile: (resourceId: string) => Promise<{ type: string; url?: string; content?: any } | null>;
  recordView: (resourceId: string) => Promise<void>;
  bookmarkResource: (resourceId: string) => Promise<void>;
  unbookmarkResource: (resourceId: string) => Promise<void>;
  checkBookmark: (resourceId: string) => Promise<boolean>;
  fetchComments: (resourceId: string) => Promise<Comment[]>;
  addComment: (resourceId: string, content: string) => Promise<Comment>;
  deleteComment: (resourceId: string, commentId: string) => Promise<void>;
}

export const useResourceStore = create<ResourceState>((set, get) => ({
  resources: [],
  pagination: null,
  isLoading: false,
  error: null,

  fetchResources: async (filters?: ResourceFilters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.tag) params.append('tag', filters.tag);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.order) params.append('order', filters.order);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.limit) params.append('limit', String(filters.limit));

      const { data } = await api.get(`/resources?${params.toString()}`);
      set({
        resources: data.resources,
        pagination: data.pagination,
      });
    } catch (error: any) {
      const message = error.response?.data?.error || '获取资源列表失败';
      set({ error: message });
      console.error('获取资源列表失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadMoreResources: async (filters?: ResourceFilters) => {
    const state = get();
    const nextPage = (state.pagination?.page || 1) + 1;
    if (state.pagination && nextPage > state.pagination.totalPages) return;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.tag) params.append('tag', filters.tag);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.order) params.append('order', filters.order);
      params.append('page', String(nextPage));
      if (filters?.limit) params.append('limit', String(filters.limit));

      const { data } = await api.get(`/resources?${params.toString()}`);
      set((prev) => ({
        resources: [...prev.resources, ...data.resources],
        pagination: data.pagination,
      }));
    } catch (error: any) {
      const message = error.response?.data?.error || '加载更多资源失败';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  createResource: async (data: CreateResourceData) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('type', data.type);
    if (data.file) formData.append('file', data.file);
    if (data.tags) formData.append('tags', JSON.stringify(data.tags));
    if (data.category) formData.append('category', data.category);
    if (data.duration) formData.append('duration', data.duration);
    if (data.points !== undefined) formData.append('points', String(data.points));

    await api.post('/resources', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  createResourceFromHomework: async (data: CreateResourceFromHomeworkData) => {
    await api.post('/resources/from-homework', data);
  },

  fetchResourceDetail: async (resourceId: string) => {
    const { data } = await api.get(`/resources/${resourceId}`);
    return data.resource;
  },

  previewResourceFile: async (resourceId: string) => {
    try {
      const { data } = await api.get(`/resources/${resourceId}/preview`);
      const { url, fileType } = data;

      if (fileType === 'pdf') {
        return { type: 'pdf', url };
      } else if (fileType === 'ipynb') {
        // Fetch notebook JSON content from signed URL
        const response = await fetch(url);
        const content = await response.json();
        return { type: 'ipynb', content };
      }
      return null;
    } catch {
      return null;
    }
  },

  recordView: async (resourceId: string) => {
    try {
      await api.post(`/resources/${resourceId}/view`);
    } catch {
      // silently ignore view tracking errors
    }
  },

  bookmarkResource: async (resourceId: string) => {
    try {
      await api.post(`/resources/${resourceId}/bookmark`);
    } catch (error: any) {
      const message = error.response?.data?.error || '收藏失败';
      throw new Error(message);
    }
  },

  unbookmarkResource: async (resourceId: string) => {
    try {
      await api.delete(`/resources/${resourceId}/bookmark`);
    } catch (error: any) {
      const message = error.response?.data?.error || '取消收藏失败';
      throw new Error(message);
    }
  },

  checkBookmark: async (resourceId: string) => {
    try {
      const { data } = await api.get(`/resources/${resourceId}/bookmark/check`);
      return data.isBookmarked;
    } catch {
      return false;
    }
  },

  fetchComments: async (resourceId: string) => {
    const { data } = await api.get(`/resources/${resourceId}/comments`);
    return data.comments.map((c: any) => ({
      id: c.id,
      userId: c.userId,
      username: c.user?.name || '匿名',
      avatar: c.user?.avatar,
      role: c.user?.role,
      content: c.content,
      createdAt: c.createdAt,
    }));
  },

  addComment: async (resourceId: string, content: string) => {
    const { data } = await api.post(`/resources/${resourceId}/comments`, { content });
    const c = data.comment;
    return {
      id: c.id,
      userId: c.userId,
      username: c.user?.name || '匿名',
      avatar: c.user?.avatar,
      role: c.user?.role,
      content: c.content,
      createdAt: c.createdAt,
    };
  },

  deleteComment: async (resourceId: string, commentId: string) => {
    await api.delete(`/resources/${resourceId}/comments/${commentId}`);
  },
}));
