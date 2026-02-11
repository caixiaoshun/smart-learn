import { create } from 'zustand';
import api from '@/lib/api';

export interface Class {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  teacherId: string;
  createdAt: string;
  _count?: {
    students: number;
    homeworks: number;
  };
  students?: Student[];
  homeworks?: Homework[];
}

export interface Student {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface Homework {
  id: string;
  title: string;
  deadline: string;
  createdAt: string;
  _count?: {
    submissions: number;
  };
}

export interface StudentClass {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  teacherId: string;
  createdAt: string;
  joinedAt: string;
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    students: number;
    homeworks: number;
  };
}

interface ClassState {
  classes: Class[];
  studentClasses: StudentClass[];
  currentClass: Class | null;
  isLoading: boolean;
  
  // 教师方法
  fetchTeacherClasses: () => Promise<void>;
  createClass: (data: { name: string; description?: string }) => Promise<Class>;
  updateClass: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  fetchClassDetail: (id: string) => Promise<void>;
  removeStudent: (classId: string, studentId: string) => Promise<void>;
  
  // 学生方法
  fetchStudentClasses: () => Promise<void>;
  joinClass: (inviteCode: string) => Promise<void>;
  leaveClass: (classId?: string) => Promise<void>;
}

export const useClassStore = create<ClassState>((set, get) => ({
  classes: [],
  studentClasses: [],
  currentClass: null,
  isLoading: false,

  // 获取教师的班级列表
  fetchTeacherClasses: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/classes/teacher');
      set({ classes: data.classes });
    } finally {
      set({ isLoading: false });
    }
  },

  // 创建班级
  createClass: async (data) => {
    const { data: result } = await api.post('/classes', data);
    set({ classes: [...get().classes, result.class] });
    return result.class;
  },

  // 更新班级
  updateClass: async (id, data) => {
    const { data: result } = await api.put(`/classes/${id}`, data);
    set({
      classes: get().classes.map((c) => (c.id === id ? result.class : c)),
      currentClass: get().currentClass?.id === id ? result.class : get().currentClass,
    });
  },

  // 删除班级
  deleteClass: async (id) => {
    await api.delete(`/classes/${id}`);
    set({
      classes: get().classes.filter((c) => c.id !== id),
      currentClass: get().currentClass?.id === id ? null : get().currentClass,
    });
  },

  // 获取班级详情
  fetchClassDetail: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/classes/${id}`);
      set({
        currentClass: data.class,
        classes: get().classes.map((c) => (c.id === id ? { ...c, ...data.class } : c)),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  // 移除学生
  removeStudent: async (classId, studentId) => {
    await api.delete(`/classes/${classId}/students/${studentId}`);
    
    // 更新当前班级的学生列表
    if (get().currentClass?.id === classId) {
      set({
        currentClass: {
          ...get().currentClass!,
          students: get().currentClass!.students?.filter((s) => s.id !== studentId),
        },
      });
    }
  },

  // 获取学生已加入的班级列表
  fetchStudentClasses: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/classes/student');
      set({ studentClasses: data.classes });
    } finally {
      set({ isLoading: false });
    }
  },

  // 学生加入班级
  joinClass: async (inviteCode) => {
    await api.post('/classes/join', { inviteCode });
  },

  // 学生退出班级
  leaveClass: async (classId) => {
    await api.post('/classes/leave', classId ? { classId } : {});
  },
}));
