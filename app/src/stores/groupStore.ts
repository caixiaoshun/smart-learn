import { create } from 'zustand';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { AssignmentGroup, LaborDivisionItem, ScoreAdjustment } from '@/types';

interface GroupState {
  groups: AssignmentGroup[];
  unassignedStudents: Array<{ id: string; name: string; email: string; avatar?: string }>;
  groupConfig: { minSize?: number; maxSize?: number } | null;
  isLoading: boolean;

  fetchGroups: (homeworkId: string) => Promise<void>;
  createGroup: (homeworkId: string, name: string) => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  lockGroup: (groupId: string) => Promise<void>;
  assignStudent: (groupId: string, studentId: string) => Promise<void>;
  autoAssignStudents: (homeworkId: string, preferredSize?: number) => Promise<void>;
  submitGroupWork: (groupId: string, homeworkId: string, files: string[], laborDivision: LaborDivisionItem[]) => Promise<void>;
  adjustScores: (submissionId: string, adjustments: Omit<ScoreAdjustment, 'id' | 'submissionId'>[]) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  unassignedStudents: [],
  groupConfig: null,
  isLoading: false,

  fetchGroups: async (homeworkId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/groups/homework/${homeworkId}`);
      set({ groups: data.groups, unassignedStudents: data.unassignedStudents || [], groupConfig: data.groupConfig || null });
    } finally {
      set({ isLoading: false });
    }
  },

  createGroup: async (homeworkId, name) => {
    const { data } = await api.post(`/groups/homework/${homeworkId}`, { name });
    set({ groups: [...get().groups, data.group] });
    toast.success('小组创建成功');
  },

  joinGroup: async (groupId) => {
    await api.post(`/groups/${groupId}/join`);
    toast.success('加入小组成功');
  },

  leaveGroup: async (groupId) => {
    await api.post(`/groups/${groupId}/leave`);
    toast.success('已退出小组');
  },

  lockGroup: async (groupId) => {
    await api.post(`/groups/${groupId}/lock`);
    toast.success('小组已锁定');
  },

  assignStudent: async (groupId, studentId) => {
    await api.post(`/groups/${groupId}/assign`, { studentId });
    toast.success('指派成功');
  },

  autoAssignStudents: async (homeworkId, preferredSize) => {
    await api.post(`/groups/homework/${homeworkId}/auto-assign`, { preferredSize });
    toast.success('自动分组完成');
    await get().fetchGroups(homeworkId);
  },

  submitGroupWork: async (groupId, homeworkId, files, laborDivision) => {
    await api.post(`/groups/${groupId}/submit`, { homeworkId, files, laborDivision });
    toast.success('项目作业提交成功');
  },

  adjustScores: async (submissionId, adjustments) => {
    await api.post(`/groups/submission/${submissionId}/adjust-scores`, { adjustments });
    toast.success('成绩调整成功');
  },
}));
