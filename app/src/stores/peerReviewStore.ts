import { create } from 'zustand';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { SelfAssessment, PeerReviewTask, PeerReview } from '@/types';

interface PeerReviewState {
  selfAssessment: SelfAssessment | null;
  allSelfAssessments: SelfAssessment[];
  myTasks: PeerReviewTask[];
  reviews: PeerReview[];
  isLoading: boolean;

  // 自评
  submitSelfAssessment: (homeworkId: string, score: number, description: string) => Promise<void>;
  fetchSelfAssessment: (homeworkId: string) => Promise<void>;
  fetchAllSelfAssessments: (homeworkId: string) => Promise<void>;

  // 互评分配
  assignPeerReviews: (homeworkId: string) => Promise<void>;
  supplementPeerReviews: (homeworkId: string) => Promise<void>;

  // 互评任务
  fetchMyTasks: () => Promise<void>;
  submitReview: (homeworkId: string, submissionId: string, score: number, comment?: string) => Promise<void>;

  // 互评结果
  fetchReviews: (submissionId: string) => Promise<void>;
  flagReview: (reviewId: string, flag: 'NORMAL' | 'FLAGGED' | 'ARBITRATED') => Promise<void>;
}

export const usePeerReviewStore = create<PeerReviewState>((set, get) => ({
  selfAssessment: null,
  allSelfAssessments: [],
  myTasks: [],
  reviews: [],
  isLoading: false,

  submitSelfAssessment: async (homeworkId, score, description) => {
    const { data } = await api.post('/peer-reviews/self-assessment', { homeworkId, score, description });
    set({ selfAssessment: data.assessment });
    toast.success('自评提交成功');
  },

  fetchSelfAssessment: async (homeworkId) => {
    const { data } = await api.get(`/peer-reviews/self-assessment/${homeworkId}`);
    set({ selfAssessment: data.assessment });
  },

  fetchAllSelfAssessments: async (homeworkId) => {
    const { data } = await api.get(`/peer-reviews/self-assessments/${homeworkId}`);
    set({ allSelfAssessments: data.assessments });
  },

  assignPeerReviews: async (homeworkId) => {
    const { data } = await api.post(`/peer-reviews/assign/${homeworkId}`);
    toast.success(`互评分配成功，共分配 ${data.totalAssignments} 个评审任务`);
  },

  supplementPeerReviews: async (homeworkId) => {
    const { data } = await api.post(`/peer-reviews/supplement/${homeworkId}`);
    toast.success(`补充分配成功，新增 ${data.supplemented} 个评审任务`);
  },

  fetchMyTasks: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/peer-reviews/my-tasks');
      set({ myTasks: data.tasks });
    } finally {
      set({ isLoading: false });
    }
  },

  submitReview: async (homeworkId, submissionId, score, comment) => {
    await api.post('/peer-reviews/review', { homeworkId, submissionId, score, comment });
    toast.success('互评提交成功');
    // 刷新任务列表
    await get().fetchMyTasks();
  },

  fetchReviews: async (submissionId) => {
    const { data } = await api.get(`/peer-reviews/reviews/${submissionId}`);
    set({ reviews: data.reviews });
  },

  flagReview: async (reviewId, flag) => {
    await api.post(`/peer-reviews/reviews/${reviewId}/flag`, { flag });
    toast.success('标记更新成功');
  },
}));
