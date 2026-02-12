import { create } from 'zustand';
import { toast } from 'sonner';
import api from '@/lib/api';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export interface Homework {
  id: string;
  title: string;
  description: string;
  type: 'STANDARD' | 'GROUP_PROJECT' | 'SELF_PRACTICE';
  classId: string;
  startTime: string;
  deadline: string;
  maxScore: number;
  allowLate: boolean;
  lateDeadline: string | null;
  reminderTime: string | null;
  reminderSent: boolean;
  groupConfig?: string | null;
  peerReviewConfig?: string | null;
  selfPracticeConfig?: string | null;
  createdAt: string;
  class?: {
    id: string;
    name: string;
  };
  _count?: {
    submissions: number;
  };
  submissions?: Submission[];
}

export interface ScoreAdjustment {
  id: string;
  submissionId: string;
  studentId: string;
  baseScore: number;
  adjustScore: number;
  finalScore: number;
  reason?: string | null;
}

export interface GroupMember {
  id: string;
  groupId: string;
  studentId: string;
  role: string;
  student: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
}

export interface SubmissionGroup {
  id: string;
  name: string;
  leaderId: string;
  leader: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  members: GroupMember[];
}

export interface Submission {
  id: string;
  studentId: string;
  homeworkId: string;
  groupId?: string | null;
  files: string[];
  laborDivision?: string | null;
  score: number | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  student?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  group?: SubmissionGroup | null;
  scoreAdjustments?: ScoreAdjustment[];
}

export interface StudentHomework extends Homework {
  isSubmitted: boolean;
  isOverdue: boolean;
  mySubmission: Submission | null;
}

interface HomeworkState {
  homeworks: Homework[];
  studentHomeworks: StudentHomework[];
  currentHomework: Homework | null;
  isLoading: boolean;
  
  // 教师方法
  fetchTeacherHomeworks: () => Promise<void>;
  createHomework: (data: CreateHomeworkData) => Promise<void>;
  updateHomework: (id: string, data: Partial<CreateHomeworkData>) => Promise<void>;
  deleteHomework: (id: string) => Promise<void>;
  fetchHomeworkDetail: (id: string) => Promise<void>;
  gradeSubmission: (homeworkId: string, submissionId: string, data: { score: number; feedback?: string }) => Promise<void>;
  gradeGroupSubmission: (homeworkId: string, submissionId: string, memberScores: { studentId: string; score: number; feedback?: string }[]) => Promise<void>;
  exportGrades: (homeworkId: string, format: 'csv' | 'json') => Promise<void>;
  generateAIReview: (payload: { homeworkTitle: string; submissionSummary: string; maxScore: number }) => Promise<string>;
  
  // 学生方法
  fetchStudentHomeworks: () => Promise<void>;
  submitHomework: (homeworkId: string, files: File[]) => Promise<void>;
  previewFile: (homeworkId: string, filename: string) => Promise<any>;
  downloadFile: (homeworkId: string, filename: string) => void;
}

export interface CreateHomeworkData {
  title: string;
  description: string;
  classId: string;
  startTime: string;
  deadline: string;
  reminderHours?: number;
  maxScore?: number;
  allowLate?: boolean;
  lateDeadline?: string;
  type?: 'STANDARD' | 'GROUP_PROJECT' | 'SELF_PRACTICE';
  groupConfig?: Record<string, unknown>;
  peerReviewConfig?: Record<string, unknown>;
  selfPracticeConfig?: Record<string, unknown>;
}

export const useHomeworkStore = create<HomeworkState>((set, get) => ({
  homeworks: [],
  studentHomeworks: [],
  currentHomework: null,
  isLoading: false,

  // 获取教师的作业列表
  fetchTeacherHomeworks: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/homeworks/teacher');
      set({ homeworks: data.homeworks });
    } finally {
      set({ isLoading: false });
    }
  },

  // 创建作业
  createHomework: async (data) => {
    const { data: result } = await api.post('/homeworks', data);
    set({ homeworks: [result.homework, ...get().homeworks] });
  },

  // 更新作业
  updateHomework: async (id, data) => {
    const { data: result } = await api.put(`/homeworks/${id}`, data);
    set({
      homeworks: get().homeworks.map((h) => (h.id === id ? result.homework : h)),
      currentHomework: get().currentHomework?.id === id ? result.homework : get().currentHomework,
    });
  },

  // 删除作业
  deleteHomework: async (id) => {
    await api.delete(`/homeworks/${id}`);
    set({
      homeworks: get().homeworks.filter((h) => h.id !== id),
      currentHomework: get().currentHomework?.id === id ? null : get().currentHomework,
    });
  },

  // 获取作业详情
  fetchHomeworkDetail: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/homeworks/${id}`);
      set({ currentHomework: data.homework });
    } finally {
      set({ isLoading: false });
    }
  },

  // 批改作业
  gradeSubmission: async (homeworkId, submissionId, data) => {
    const { data: result } = await api.post(`/homeworks/${homeworkId}/grade/${submissionId}`, data);
    
    // 更新当前作业的提交列表
    if (get().currentHomework?.id === homeworkId) {
      set({
        currentHomework: {
          ...get().currentHomework!,
          submissions: get().currentHomework!.submissions?.map((s) =>
            s.id === submissionId ? result.submission : s
          ),
        },
      });
    }
  },

  // 小组作业批改 - 给每个成员单独打分
  gradeGroupSubmission: async (homeworkId, submissionId, memberScores) => {
    const { data: result } = await api.post(`/homeworks/${homeworkId}/grade-group/${submissionId}`, { memberScores });

    // 更新 homeworks 列表中对应的 submission
    set({
      homeworks: get().homeworks.map((h) => {
        if (h.id !== homeworkId) return h;
        return {
          ...h,
          submissions: h.submissions?.map((s) =>
            s.id === submissionId ? result.submission : s
          ),
        };
      }),
    });

    // 更新 currentHomework
    if (get().currentHomework?.id === homeworkId) {
      set({
        currentHomework: {
          ...get().currentHomework!,
          submissions: get().currentHomework!.submissions?.map((s) =>
            s.id === submissionId ? result.submission : s
          ),
        },
      });
    }
  },

  // 导出成绩
  exportGrades: async (homeworkId, format) => {
    const { data } = await api.get(`/homeworks/${homeworkId}/export`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json',
    });
    
    if (format === 'csv') {
      triggerBlobDownload(data, '成绩单.csv');
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerBlobDownload(blob, '成绩单.json');
    }
    toast.success('成绩导出成功');
  },


  generateAIReview: async ({ homeworkTitle, submissionSummary, maxScore }) => {
    const prompt = `你是一名课程教师助教，请基于以下信息生成批改建议。
作业标题：${homeworkTitle}
作业满分：${maxScore}
学生提交摘要：${submissionSummary}

请输出 Markdown，包含：
1) 总体评价
2) 优点（2-4条）
3) 待改进点（2-4条）
4) 建议分数（0-${maxScore}）
5) 可直接给学生的反馈。`;
    const { data } = await api.post('/ai/chat', { content: prompt });
    const content = data?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('AI 返回内容为空');
    }
    return content;
  },

  // 获取学生的作业列表
  fetchStudentHomeworks: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/homeworks/student');
      set({ studentHomeworks: data.homeworks });
    } finally {
      set({ isLoading: false });
    }
  },

  // 提交作业
  submitHomework: async (homeworkId, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    
    await api.post(`/homeworks/${homeworkId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    // 刷新学生作业列表
    await get().fetchStudentHomeworks();
  },

  // 预览文件
  previewFile: async (homeworkId, filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const response = await api.get(`/homeworks/${homeworkId}/preview/${filename}`, {
      responseType: 'blob',
    });
    
    if (ext === 'pdf') {
      return { type: 'pdf', url: URL.createObjectURL(response.data) };
    } else if (ext === 'ipynb') {
      const text = await response.data.text();
      const content = JSON.parse(text);
      return { type: 'ipynb', content };
    }
    
    // 不支持的格式，降级为下载
    triggerBlobDownload(response.data, filename);
    toast.info('该格式不支持在线预览，已为您下载');
    return null;
  },

  // 下载文件
  downloadFile: (homeworkId, filename) => {
    api.get(`/homeworks/${homeworkId}/download/${filename}`, { responseType: 'blob' })
      .then((response) => {
        triggerBlobDownload(response.data, filename);
      });
  },
}));
