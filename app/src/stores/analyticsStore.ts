import { create } from 'zustand';
import api from '@/lib/api';

export interface HomeworkStats {
  id: string;
  title: string;
  deadline: string;
  maxScore: number;
  statistics: {
    totalStudents: number;
    submitted: number;
    notSubmitted: number;
    submissionRate: number;
    scoredCount: number;
    notScoredCount: number;
    highestScore?: number;
    lowestScore?: number;
    averageScore?: number;
  };
}

export interface ScoreDistribution {
  label: string;
  count: number;
  percentage: number;
}

export interface GradeTrend {
  homeworkId: string;
  homeworkTitle: string;
  deadline: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
}

export interface ClassOverview {
  class: {
    id: string;
    name: string;
    studentCount: number;
    homeworkCount: number;
  };
  overview: {
    overallSubmissionRate: number;
    averageScore: number;
    totalSubmissions: number;
    totalExpected: number;
  };
  topStudents: {
    id: string;
    name: string;
    totalScore: number;
    submissionCount: number;
  }[];
  needAttention: {
    id: string;
    name: string;
    totalScore: number;
    submissionCount: number;
  }[];
}

interface AnalyticsState {
  homeworkStats: HomeworkStats[];
  scoreDistribution: ScoreDistribution[] | null;
  gradeTrend: GradeTrend[];
  classOverview: ClassOverview | null;
  isLoading: boolean;
  
  // 教师方法
  fetchClassHomeworkStats: (classId: string) => Promise<void>;
  fetchScoreDistribution: (homeworkId: string) => Promise<void>;
  fetchClassOverview: (classId: string) => Promise<void>;
  
  // 学生方法
  fetchStudentGradeTrend: () => Promise<void>;
  fetchStudentTrendByTeacher: (studentId: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  homeworkStats: [],
  scoreDistribution: null,
  gradeTrend: [],
  classOverview: null,
  isLoading: false,

  // 获取班级作业统计
  fetchClassHomeworkStats: async (classId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/analytics/class/${classId}/homeworks`);
      set({ homeworkStats: data.homeworks });
    } finally {
      set({ isLoading: false });
    }
  },

  // 获取成绩分布
  fetchScoreDistribution: async (homeworkId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/analytics/homework/${homeworkId}/distribution`);
      set({ scoreDistribution: data.distribution });
    } finally {
      set({ isLoading: false });
    }
  },

  // 获取班级概览
  fetchClassOverview: async (classId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/analytics/class/${classId}/overview`);
      set({ classOverview: data });
    } finally {
      set({ isLoading: false });
    }
  },

  // 学生获取自己的成绩走势
  fetchStudentGradeTrend: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/analytics/student/trend');
      set({ gradeTrend: data.trend });
    } finally {
      set({ isLoading: false });
    }
  },

  // 教师查看学生成绩走势
  fetchStudentTrendByTeacher: async (studentId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/analytics/student/${studentId}/trend`);
      set({ gradeTrend: data.trend });
    } finally {
      set({ isLoading: false });
    }
  },
}));
