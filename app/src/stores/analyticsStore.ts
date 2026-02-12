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

export interface StudentClusterItem {
  student: { id: string; name: string; email: string; avatar?: string };
  avgScoreRate: number;
  submissionRate: number;
  onTimeRate: number;
  composite: number;
  cluster: 'HIGH' | 'MEDIUM' | 'AT_RISK';
}

export interface ClusterSummary {
  highCount: number;
  mediumCount: number;
  atRiskCount: number;
  highPercentage: number;
  mediumPercentage: number;
  atRiskPercentage: number;
}

export interface ScatterPoint {
  name: string;
  studentId: string;
  x: number;
  y: number;
}

export interface ComprehensiveStats {
  overview: {
    studentCount: number;
    homeworkCount: number;
    totalScored: number;
    avgScore: number;
    medianScore: number;
    stdDev: number;
    passRate: number;
    excellentRate: number;
  };
  scoreDistribution: { label: string; count: number; percentage: number; color: string }[];
  homeworkTrend: { title: string; avg: number; highest: number; lowest: number; submissionRate: number }[];
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

export interface ScoreHeatmapData {
  homeworks: { id: string; title: string }[];
  students: { id: string; name: string; scores: (number | null)[] }[];
}

export interface EngagementBubble {
  name: string;
  studentId: string;
  x: number;
  y: number;
  z: number;
}

export interface StudentTrendsData {
  homeworks: { id: string; title: string }[];
  trendData: Record<string, string | number>[];
  studentNames: string[];
}

export interface CompetencyKeyword {
  name: string;
  value: number;
}

interface AnalyticsState {
  homeworkStats: HomeworkStats[];
  scoreDistribution: ScoreDistribution[] | null;
  gradeTrend: GradeTrend[];
  classOverview: ClassOverview | null;
  studentClusters: { clusters: { HIGH: StudentClusterItem[]; MEDIUM: StudentClusterItem[]; AT_RISK: StudentClusterItem[] }; summary: ClusterSummary; totalStudents: number } | null;
  scatterData: { points: ScatterPoint[]; xLabel: string; yLabel: string } | null;
  comprehensiveStats: ComprehensiveStats | null;
  scoreHeatmap: ScoreHeatmapData | null;
  engagementBubbles: { bubbles: EngagementBubble[]; xLabel: string; yLabel: string; zLabel: string } | null;
  studentTrends: StudentTrendsData | null;
  competencyKeywords: CompetencyKeyword[] | null;
  isLoading: boolean;
  
  // 教师方法
  fetchClassHomeworkStats: (classId: string) => Promise<void>;
  fetchScoreDistribution: (homeworkId: string) => Promise<void>;
  fetchClassOverview: (classId: string) => Promise<void>;
  fetchStudentClusters: (classId: string) => Promise<void>;
  fetchPerformanceScatter: (classId: string) => Promise<void>;
  fetchComprehensiveStats: (classId: string) => Promise<void>;
  fetchScoreHeatmap: (classId: string) => Promise<void>;
  fetchEngagementBubbles: (classId: string) => Promise<void>;
  fetchStudentTrends: (classId: string) => Promise<void>;
  fetchCompetencyKeywords: (classId: string) => Promise<void>;
  
  // 学生方法
  fetchStudentGradeTrend: () => Promise<void>;
  fetchStudentTrendByTeacher: (studentId: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  homeworkStats: [],
  scoreDistribution: null,
  gradeTrend: [],
  classOverview: null,
  studentClusters: null,
  scatterData: null,
  comprehensiveStats: null,
  scoreHeatmap: null,
  engagementBubbles: null,
  studentTrends: null,
  competencyKeywords: null,
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

  // 获取学生聚类分析
  fetchStudentClusters: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/student-clusters`);
      set({ studentClusters: data });
    } catch (error) {
      console.error('获取学生聚类分析失败:', error);
    }
  },

  // 获取学生表现散点图
  fetchPerformanceScatter: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/performance-scatter`);
      set({ scatterData: data });
    } catch (error) {
      console.error('获取学生表现散点图失败:', error);
    }
  },

  // 获取综合成绩统计
  fetchComprehensiveStats: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/comprehensive-stats`);
      set({ comprehensiveStats: data });
    } catch (error) {
      console.error('获取综合成绩统计失败:', error);
    }
  },

  // 获取成绩热力图
  fetchScoreHeatmap: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/score-heatmap`);
      set({ scoreHeatmap: data });
    } catch (error) {
      console.error('获取成绩热力图失败:', error);
    }
  },

  // 获取学习参与度气泡图
  fetchEngagementBubbles: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/engagement-bubble`);
      set({ engagementBubbles: data });
    } catch (error) {
      console.error('获取学习参与度气泡图失败:', error);
    }
  },

  // 获取多学生成绩趋势
  fetchStudentTrends: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/student-trends`);
      set({ studentTrends: data });
    } catch (error) {
      console.error('获取多学生成绩趋势失败:', error);
    }
  },

  // 获取能力关键词词云
  fetchCompetencyKeywords: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/competency-keywords`);
      set({ competencyKeywords: data.keywords });
    } catch (error) {
      console.error('获取能力关键词失败:', error);
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
