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

export interface GradeComposition {
  composition: { name: string; value: number; color: string }[];
  studentCount: number;
}

export interface IndicatorRadarItem {
  name: string;
  value: number;
  fullMark: number;
}

export interface HeatmapData {
  students: { id: string; name: string }[];
  timeBuckets: string[];
  matrix: number[][];
}

export interface StudentProfile {
  student: { id: string; name: string; email: string; avatar?: string };
  homeworkScores: { homeworkId: string; title: string; maxScore: number; score: number | null; submitted: boolean; onTime: boolean }[];
  performance: {
    qa: { count: number; records: { type: string; topic: string | null; score: number | null; occurredAt: string }[] };
    share: { count: number; records: { type: string; topic: string | null; score: number | null; occurredAt: string }[] };
  };
  selfAssessments: { homeworkTitle: string; score: number; description: string }[];
  peerReviews: {
    given: { homeworkTitle: string; score: number; comment: string | null }[];
    received: { homeworkTitle: string; score: number; comment: string | null }[];
  };
  metrics: { avgScoreRate: number; submissionRate: number; onTimeRate: number; composite: number; cluster: 'HIGH' | 'MEDIUM' | 'AT_RISK' };
}

export interface PeerReviewStats {
  selfAssessment: {
    totalCount: number;
    distribution: { range: string; count: number }[];
    average: number;
  };
  peerReview: {
    totalCount: number;
    distribution: { range: string; count: number }[];
    average: number;
    consistencyStdDev: number;
  };
  selfVsTeacher: { selfScore: number; teacherScore: number; studentId: string }[];
}

interface AnalyticsState {
  homeworkStats: HomeworkStats[];
  scoreDistribution: ScoreDistribution[] | null;
  gradeTrend: GradeTrend[];
  classOverview: ClassOverview | null;
  studentClusters: { method?: string; silhouetteScore?: number; clusters: { HIGH: StudentClusterItem[]; MEDIUM: StudentClusterItem[]; AT_RISK: StudentClusterItem[] }; summary: ClusterSummary; totalStudents: number } | null;
  scatterData: { points: ScatterPoint[]; xLabel: string; yLabel: string } | null;
  comprehensiveStats: ComprehensiveStats | null;
  gradeComposition: GradeComposition | null;
  indicatorRadar: IndicatorRadarItem[] | null;
  heatmapData: HeatmapData | null;
  studentProfile: StudentProfile | null;
  peerReviewStats: PeerReviewStats | null;
  isLoading: boolean;
  
  // 教师方法
  fetchClassHomeworkStats: (classId: string) => Promise<void>;
  fetchScoreDistribution: (homeworkId: string) => Promise<void>;
  fetchClassOverview: (classId: string) => Promise<void>;
  fetchStudentClusters: (classId: string, method?: string, k?: number) => Promise<void>;
  fetchPerformanceScatter: (classId: string) => Promise<void>;
  fetchComprehensiveStats: (classId: string) => Promise<void>;
  fetchGradeComposition: (classId: string) => Promise<void>;
  fetchIndicatorRadar: (classId: string) => Promise<void>;
  fetchPerformanceHeatmap: (classId: string) => Promise<void>;
  fetchStudentProfile: (classId: string, studentId: string) => Promise<void>;
  fetchPeerReviewStats: (classId: string) => Promise<void>;
  
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
  gradeComposition: null,
  indicatorRadar: null,
  heatmapData: null,
  studentProfile: null,
  peerReviewStats: null,
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
  fetchStudentClusters: async (classId, method, k) => {
    try {
      const params = new URLSearchParams();
      if (method) params.set('method', method);
      if (k) params.set('k', String(k));
      const query = params.toString() ? `?${params.toString()}` : '';
      const { data } = await api.get(`/analytics/class/${classId}/student-clusters${query}`);
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

  // 获取成绩构成数据
  fetchGradeComposition: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/grade-composition`);
      set({ gradeComposition: data });
    } catch (error) {
      console.error('获取成绩构成失败:', error);
    }
  },

  // 获取指标雷达数据
  fetchIndicatorRadar: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/indicator-radar`);
      set({ indicatorRadar: data.indicators });
    } catch (error) {
      console.error('获取指标雷达失败:', error);
    }
  },

  // 获取表现热力图数据
  fetchPerformanceHeatmap: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/performance-heatmap`);
      set({ heatmapData: data });
    } catch (error) {
      console.error('获取表现热力图失败:', error);
    }
  },

  // 获取学生画像
  fetchStudentProfile: async (classId, studentId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/student/${studentId}/profile`);
      set({ studentProfile: data });
    } catch (error) {
      console.error('获取学生画像失败:', error);
    }
  },

  // 获取评价分析数据
  fetchPeerReviewStats: async (classId) => {
    try {
      const { data } = await api.get(`/analytics/class/${classId}/peer-review-stats`);
      set({ peerReviewStats: data });
    } catch (error) {
      console.error('获取评价分析失败:', error);
    }
  },
}));
