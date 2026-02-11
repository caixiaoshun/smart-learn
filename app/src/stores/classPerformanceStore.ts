import { create } from 'zustand';
import { toast } from 'sonner';
import api from '@/lib/api';
import type {
  ClassPerformanceRecord,
  PerformanceSummary,
  PerformanceType,
  KnowledgePoint,
  KnowledgeDistribution,
  KnowledgePointAssessment,
} from '@/types';

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

interface ScoringRules {
  maxScore: number;
  qaWeight: number;
  shareWeight: number;
}

interface ClassPerformanceState {
  records: ClassPerformanceRecord[];
  summary: PerformanceSummary[];
  knowledgePoints: KnowledgePoint[];
  knowledgeDistribution: KnowledgeDistribution[];
  scoringRules: ScoringRules;
  isLoading: boolean;

  // 记录管理
  createRecord: (data: {
    classId: string;
    studentId: string;
    type: PerformanceType;
    topic?: string;
    score?: number;
    notes?: string;
    evidence?: string;
    duration?: number;
    occurredAt?: string;
  }) => Promise<void>;
  fetchRecords: (classId: string, type?: PerformanceType, studentId?: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;

  // 统计汇总
  fetchSummary: (classId: string) => Promise<void>;
  exportRecords: (classId: string, format: 'csv' | 'json') => Promise<void>;

  // 评分规则
  fetchScoringRules: (classId: string) => Promise<void>;
  updateScoringRules: (classId: string, rules: ScoringRules) => Promise<void>;

  // 知识点
  publishKnowledgePoints: (classId: string, points: { title: string; description?: string }[]) => Promise<void>;
  fetchKnowledgePoints: (classId: string) => Promise<void>;
  submitKnowledgeAssessments: (assessments: Omit<KnowledgePointAssessment, 'studentId'>[]) => Promise<void>;
  fetchMyKnowledgeAssessments: (classId: string) => Promise<void>;
  fetchKnowledgeDistribution: (classId: string) => Promise<void>;
}

export const useClassPerformanceStore = create<ClassPerformanceState>((set, get) => ({
  records: [],
  summary: [],
  knowledgePoints: [],
  knowledgeDistribution: [],
  scoringRules: { maxScore: 5, qaWeight: 0.5, shareWeight: 0.5 },
  isLoading: false,

  createRecord: async (data) => {
    const { data: result } = await api.post('/class-performance/record', data);
    set({ records: [result.record, ...get().records] });
    toast.success('记录创建成功');
  },

  fetchRecords: async (classId, type, studentId) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string> = {};
      if (type) params.type = type;
      if (studentId) params.studentId = studentId;
      const { data } = await api.get(`/class-performance/records/${classId}`, { params });
      set({ records: data.records });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRecord: async (id) => {
    await api.delete(`/class-performance/record/${id}`);
    set({ records: get().records.filter(r => r.id !== id) });
    toast.success('记录删除成功');
  },

  fetchSummary: async (classId) => {
    const { data } = await api.get(`/class-performance/summary/${classId}`);
    set({ summary: data.summary });
  },

  exportRecords: async (classId, format) => {
    const { data } = await api.get(`/class-performance/export/${classId}`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json',
    });

    if (format === 'csv') {
      triggerBlobDownload(data, '平时表现.csv');
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerBlobDownload(blob, '平时表现.json');
    }
    toast.success('导出成功');
  },

  fetchScoringRules: async (classId) => {
    const { data } = await api.get(`/class-performance/scoring-rules/${classId}`);
    set({ scoringRules: data.rules });
  },

  updateScoringRules: async (classId, rules) => {
    const { data } = await api.put(`/class-performance/scoring-rules/${classId}`, rules);
    set({ scoringRules: data.rules });
  },

  publishKnowledgePoints: async (classId, points) => {
    const { data } = await api.post('/class-performance/knowledge-points', { classId, points });
    set({ knowledgePoints: [...get().knowledgePoints, ...data.knowledgePoints] });
    toast.success('知识点清单发布成功');
  },

  fetchKnowledgePoints: async (classId) => {
    const { data } = await api.get(`/class-performance/knowledge-points/${classId}`);
    set({ knowledgePoints: data.knowledgePoints });
  },

  submitKnowledgeAssessments: async (assessments) => {
    await api.post('/class-performance/knowledge-assessment', { assessments });
    toast.success('知识点自评提交成功');
  },

  fetchMyKnowledgeAssessments: async (classId) => {
    const { data } = await api.get(`/class-performance/knowledge-assessment/${classId}`);
    set({ knowledgePoints: data.knowledgePoints });
  },

  fetchKnowledgeDistribution: async (classId) => {
    const { data } = await api.get(`/class-performance/knowledge-distribution/${classId}`);
    set({ knowledgeDistribution: data.distribution });
  },
}));
