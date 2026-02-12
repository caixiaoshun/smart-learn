import { create } from 'zustand';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { AssignmentGroup, GroupMessage, LaborDivisionItem, ScoreAdjustment, GroupConfig } from '@/types';

interface MyGroupStatus {
  myGroup: AssignmentGroup | null;
  groupConfig: GroupConfig;
  homework: {
    id: string;
    title: string;
    deadline: string;
    classId: string;
    className: string;
  };
  stats: {
    totalStudents: number;
    assignedCount: number;
  };
}

interface GroupState {
  groups: AssignmentGroup[];
  unassignedStudents: Array<{ id: string; name: string; email: string; avatar?: string }>;
  groupConfig: { minSize?: number; maxSize?: number } | null;
  isLoading: boolean;

  // Student group formation state
  myGroupStatus: MyGroupStatus | null;
  messages: GroupMessage[];
  messagesLoading: boolean;

  fetchGroups: (homeworkId: string) => Promise<void>;
  createGroup: (homeworkId: string, name: string) => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  joinGroupByCode: (inviteCode: string) => Promise<{ groupId: string; homeworkId: string }>;
  leaveGroup: (groupId: string) => Promise<void>;
  lockGroup: (groupId: string) => Promise<void>;
  assignStudent: (groupId: string, studentId: string) => Promise<void>;
  autoAssignStudents: (homeworkId: string, preferredSize?: number) => Promise<void>;
  submitGroupWork: (groupId: string, homeworkId: string, files: File[], laborDivision: LaborDivisionItem[]) => Promise<void>;
  adjustScores: (submissionId: string, adjustments: Omit<ScoreAdjustment, 'id' | 'submissionId'>[]) => Promise<void>;
  
  // Student group formation methods
  fetchMyGroup: (homeworkId: string) => Promise<void>;
  removeMember: (groupId: string, studentId: string) => Promise<void>;
  transferLeader: (groupId: string, newLeaderId: string) => Promise<void>;
  dissolveGroup: (groupId: string) => Promise<void>;
  fetchMessages: (groupId: string) => Promise<void>;
  sendMessage: (groupId: string, content: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  unassignedStudents: [],
  groupConfig: null,
  isLoading: false,
  myGroupStatus: null,
  messages: [],
  messagesLoading: false,

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

  joinGroupByCode: async (inviteCode) => {
    const { data } = await api.post('/groups/join-by-code', { inviteCode });
    toast.success('加入小组成功');
    return { groupId: data.groupId, homeworkId: data.homeworkId };
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
    const formData = new FormData();
    formData.append('homeworkId', homeworkId);
    formData.append('laborDivision', JSON.stringify(laborDivision));
    files.forEach((file) => formData.append('files', file));

    await api.post(`/groups/${groupId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    toast.success('项目作业提交成功');
  },

  adjustScores: async (submissionId, adjustments) => {
    await api.post(`/groups/submission/${submissionId}/adjust-scores`, { adjustments });
    toast.success('成绩调整成功');
  },

  fetchMyGroup: async (homeworkId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/groups/homework/${homeworkId}/my-group`);
      set({ myGroupStatus: data });
    } finally {
      set({ isLoading: false });
    }
  },

  removeMember: async (groupId, studentId) => {
    await api.post(`/groups/${groupId}/remove-member`, { studentId });
    toast.success('已移除该成员');
  },

  transferLeader: async (groupId, newLeaderId) => {
    await api.post(`/groups/${groupId}/transfer-leader`, { newLeaderId });
    toast.success('组长已转让');
  },

  dissolveGroup: async (groupId) => {
    await api.post(`/groups/${groupId}/dissolve`);
    toast.success('队伍已解散');
  },

  fetchMessages: async (groupId) => {
    set({ messagesLoading: true });
    try {
      const { data } = await api.get(`/groups/${groupId}/messages`);
      set({ messages: data.messages });
    } finally {
      set({ messagesLoading: false });
    }
  },

  sendMessage: async (groupId, content) => {
    const { data } = await api.post(`/groups/${groupId}/messages`, { content });
    set({ messages: [...get().messages, data] });
  },
}));
