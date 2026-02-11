import { create } from 'zustand';
import api from '@/lib/api';
import type { Course } from '@/types';

interface CourseState {
  courses: Course[];
  currentCourse: Course | null;
  isLoading: boolean;
  error: string | null;

  fetchCourses: () => Promise<void>;
  fetchCourseById: (id: string) => Promise<void>;
  downloadSyllabus: (id: string) => Promise<void>;
}

export const useCourseStore = create<CourseState>((set) => ({
  courses: [],
  currentCourse: null,
  isLoading: false,
  error: null,

  fetchCourses: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/courses');
      set({ courses: data.courses || [] });
    } catch (error: any) {
      const message = error.response?.data?.error || '获取课程列表失败';
      set({ error: message, courses: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCourseById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/courses/${id}`);
      set({ currentCourse: data.course || null });
    } catch (error: any) {
      const message = error.response?.data?.error || '获取课程详情失败';
      set({ error: message, currentCourse: null });
    } finally {
      set({ isLoading: false });
    }
  },

  downloadSyllabus: async (id: string) => {
    try {
      const response = await api.get(`/courses/${id}/outline`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition header if available
      const disposition = response.headers['content-disposition'];
      let filename = 'course-outline.txt';
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=["']?([^"';\n]*)["']?/);
        if (match?.[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      const message = error.response?.data?.error || '下载大纲失败';
      throw new Error(message);
    }
  },
}));
