import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useHomeworkStore, type Homework, type Submission, type CreateHomeworkData } from '@/stores/homeworkStore';
import { useClassStore } from '@/stores/classStore';
import { useGroupStore } from '@/stores/groupStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Clock, 
  Users, 
  FileText, 
  Download, 
  FileCheck,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Code,
  MessageSquare,
  Save,
  ArrowLeft,
  Loader2,
  WandSparkles,
  GripVertical,
  BookOpen,
  CalendarClock,
  Star,
  Bell,
  Settings2,
  UserCheck,
  Target,
  Crown,
  User,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { NotebookPreview } from '@/components/NotebookPreview';

interface LaborDivisionEntry {
  memberId?: string;
  memberName?: string;
  task?: string;
  contributionPercent?: number;
  description?: string;
}

function parseLaborDivision(raw: string | null | undefined): LaborDivisionEntry[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

function getFileIcon(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <FileText className="w-4 h-4 shrink-0 text-red-500" />;
    case 'ipynb':
    case 'py':
    case 'js':
    case 'ts':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
      return <Code className="w-4 h-4 shrink-0 text-blue-500" />;
    default:
      return <FileText className="w-4 h-4 shrink-0 text-gray-500" />;
  }
}

// PDF 预览组件
function PDFPreview({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="w-full h-full border-0 min-h-[500px]"
      title="PDF Preview"
    />
  );
}

export function HomeworkManagementPage() {
  const { homeworks, isLoading, fetchTeacherHomeworks, createHomework, updateHomework, gradeSubmission, gradeGroupSubmission, exportGrades, previewFile, downloadFile } = useHomeworkStore();
  const { classes, fetchTeacherClasses } = useClassStore();
  const { groups, unassignedStudents, groupConfig, fetchGroups, assignStudent, autoAssignStudents } = useGroupStore();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isGradingMode, setIsGradingMode] = useState(false);
  
  // 表单状态
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [reminderHours, setReminderHours] = useState('24');
  const [maxScore, setMaxScore] = useState('100');
  const [allowLate, setAllowLate] = useState(false);
  const [lateDeadline, setLateDeadline] = useState('');
  const [homeworkType, setHomeworkType] = useState<'STANDARD' | 'GROUP_PROJECT' | 'SELF_PRACTICE'>('STANDARD');
  const [groupMinSize, setGroupMinSize] = useState('2');
  const [groupMaxSize, setGroupMaxSize] = useState('6');
  const [groupDeadline, setGroupDeadline] = useState('');
  const [reviewersCount, setReviewersCount] = useState('3');
  const [reviewDeadline, setReviewDeadline] = useState('');
  const [bonusCap, setBonusCap] = useState('10');
  const [countLimit, setCountLimit] = useState('5');
  
  // 编辑表单状态
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editMaxScore, setEditMaxScore] = useState('100');
  const [editAllowLate, setEditAllowLate] = useState(false);
  const [editLateDeadline, setEditLateDeadline] = useState('');
  // 编辑 - 小组作业配置
  const [editGroupMinSize, setEditGroupMinSize] = useState('2');
  const [editGroupMaxSize, setEditGroupMaxSize] = useState('6');
  const [editGroupDeadline, setEditGroupDeadline] = useState('');
  const [editReviewersCount, setEditReviewersCount] = useState('3');
  const [editReviewDeadline, setEditReviewDeadline] = useState('');
  // 编辑 - 自主实践配置
  const [editBonusCap, setEditBonusCap] = useState('10');
  const [editCountLimit, setEditCountLimit] = useState('5');

  // 批改状态
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  
  // 小组成员单独打分状态
  const [groupMemberScores, setGroupMemberScores] = useState<Record<string, string>>({});
  const [groupMemberFeedbacks, setGroupMemberFeedbacks] = useState<Record<string, string>>({});
  // 文件预览状态
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [previewContent, setPreviewContent] = useState<{ type: string; url?: string; content?: any } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // 学生导航索引
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);

  const [isGroupCenterOpen, setIsGroupCenterOpen] = useState(false);
  const [groupHomework, setGroupHomework] = useState<Homework | null>(null);
  const [dragStudentId, setDragStudentId] = useState<string | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isGeneratingAIReview, setIsGeneratingAIReview] = useState(false);

  // Quick feedback templates
  const feedbackTemplates = [
    '代码逻辑清晰，运行结果正确，很好！',
    '代码能运行但缺少注释，建议添加必要的代码注释。',
    '部分输出结果不正确，请检查算法逻辑。',
    '缺少关键步骤，请参考课件补充完善。',
    '代码风格良好，但存在一些边界情况未处理。',
    '实验报告格式规范，分析到位。',
  ];


  const openGroupCenter = async (homework: Homework) => {
    if (homework.type !== 'GROUP_PROJECT') {
      toast.error('仅项目小组作业支持组队中心');
      return;
    }
    setGroupHomework(homework);
    await fetchGroups(homework.id);
    setIsGroupCenterOpen(true);
  };

  const handleDropToGroup = async (groupId: string) => {
    if (!dragStudentId || !groupHomework) return;
    try {
      await assignStudent(groupId, dragStudentId);
      await fetchGroups(groupHomework.id);
    } catch {
      // 错误由拦截器处理
    } finally {
      setDragStudentId(null);
    }
  };

  const handleAutoAssign = async () => {
    if (!groupHomework) return;
    setIsAutoAssigning(true);
    try {
      const preferred = groupConfig?.maxSize || 4;
      await autoAssignStudents(groupHomework.id, preferred);
    } catch {
      // 错误由拦截器处理
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleGenerateAIReview = async () => {
    if (!selectedHomework || !selectedSubmission) return;
    setIsGeneratingAIReview(true);
    try {
      const summary = `学生：${selectedSubmission.student?.name || '未知'}
提交文件：${selectedSubmission.files.join(', ')}
已有分数：${selectedSubmission.score ?? '未评分'}
已有评语：${selectedSubmission.feedback || '无'}`;
      const aiMarkdown = await useHomeworkStore.getState().generateAIReview({
        homeworkTitle: selectedHomework.title,
        submissionSummary: summary,
        maxScore: selectedHomework.maxScore,
      });
      setGradeFeedback(aiMarkdown);
      toast.success('已生成 AI 批改建议');
    } catch {
      toast.error('AI 批改建议生成失败');
    } finally {
      setIsGeneratingAIReview(false);
    }
  };

  useEffect(() => {
    fetchTeacherHomeworks();
    fetchTeacherClasses();
  }, []);

  useEffect(() => {
    if (classes.length === 1 && !classId) {
      setClassId(classes[0].id);
    }
  }, [classes]);

  const handleCreateHomework = async () => {
    if (!title.trim()) {
      toast.error('请输入作业标题');
      return;
    }
    if (!classId) {
      toast.error('请选择班级');
      return;
    }
    if (!deadline) {
      toast.error('请设置截止时间');
      return;
    }
    if (allowLate && !lateDeadline) {
      toast.error('允许迟交时，请设置迟交截止时间');
      return;
    }
    if (allowLate && lateDeadline && deadline && new Date(lateDeadline) <= new Date(deadline)) {
      toast.error('迟交截止时间必须晚于正常截止时间');
      return;
    }
    
    try {
      const data: CreateHomeworkData = {
        title,
        description,
        classId,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        deadline: new Date(deadline).toISOString(),
        reminderHours: parseInt(reminderHours) || undefined,
        maxScore: parseInt(maxScore) || 100,
        allowLate,
        lateDeadline: allowLate && lateDeadline ? new Date(lateDeadline).toISOString() : undefined,
        type: homeworkType,
      };

      if (homeworkType === 'GROUP_PROJECT') {
        data.groupConfig = {
          groupRequired: true,
          minSize: parseInt(groupMinSize) || 2,
          maxSize: parseInt(groupMaxSize) || 6,
          groupDeadline: groupDeadline ? new Date(groupDeadline).toISOString() : undefined,
          allowSwitch: true,
          allowTeacherAssign: true,
          ungroupedPolicy: 'TEACHER_ASSIGN',
          scoringModel: 'BASE_PLUS_ADJUST',
        };
        data.peerReviewConfig = {
          reviewersPerSubmission: parseInt(reviewersCount) || 3,
          reviewDeadline: reviewDeadline ? new Date(reviewDeadline).toISOString() : undefined,
          penaltyLevel: 'MEDIUM',
          anonymousMode: 'DOUBLE_BLIND',
          minReviewsRequired: parseInt(reviewersCount) || 3,
          coverageStrategy: 'AUTO_SUPPLEMENT',
        };
      }

      if (homeworkType === 'SELF_PRACTICE') {
        data.selfPracticeConfig = {
          bonusCap: parseInt(bonusCap) || 10,
          countLimit: parseInt(countLimit) || 5,
          qualityThreshold: 60,
          scoringStrategy: 'BONUS',
          antiCheatRules: ['每日提交上限3次', '需通过质量门槛审查', '教师可抽检'],
        };
      }

      await createHomework(data);
      
      setIsCreateDialogOpen(false);
      resetForm();
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClassId('');
    setStartTime('');
    setDeadline('');
    setReminderHours('24');
    setMaxScore('100');
    setAllowLate(false);
    setHomeworkType('STANDARD');
    setGroupMinSize('2');
    setGroupMaxSize('6');
    setGroupDeadline('');
    setReviewersCount('3');
    setReviewDeadline('');
    setBonusCap('10');
    setCountLimit('5');
  };

  const toLocalDatetimeString = (isoStr: string) => {
    const d = new Date(isoStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEditDialog = (homework: Homework) => {
    setEditingHomework(homework);
    setEditTitle(homework.title);
    setEditDescription(homework.description || '');
    setEditStartTime(toLocalDatetimeString(homework.startTime));
    setEditDeadline(toLocalDatetimeString(homework.deadline));
    setEditMaxScore(homework.maxScore.toString());
    setEditAllowLate(homework.allowLate);
    setEditLateDeadline(homework.lateDeadline ? toLocalDatetimeString(homework.lateDeadline) : '');

    // 解析小组作业配置
    if (homework.type === 'GROUP_PROJECT' && homework.groupConfig) {
      try {
        const gc = typeof homework.groupConfig === 'string' ? JSON.parse(homework.groupConfig) : homework.groupConfig;
        setEditGroupMinSize(gc.minSize?.toString() || '2');
        setEditGroupMaxSize(gc.maxSize?.toString() || '6');
        setEditGroupDeadline(gc.groupDeadline ? toLocalDatetimeString(gc.groupDeadline) : '');
      } catch { setEditGroupMinSize('2'); setEditGroupMaxSize('6'); setEditGroupDeadline(''); }
      try {
        const pr = typeof homework.peerReviewConfig === 'string' ? JSON.parse(homework.peerReviewConfig) : homework.peerReviewConfig;
        setEditReviewersCount(pr?.reviewersPerSubmission?.toString() || '3');
        setEditReviewDeadline(pr?.reviewDeadline ? toLocalDatetimeString(pr.reviewDeadline) : '');
      } catch { setEditReviewersCount('3'); setEditReviewDeadline(''); }
    }

    // 解析自主实践配置
    if (homework.type === 'SELF_PRACTICE' && homework.selfPracticeConfig) {
      try {
        const sp = typeof homework.selfPracticeConfig === 'string' ? JSON.parse(homework.selfPracticeConfig) : homework.selfPracticeConfig;
        setEditBonusCap(sp.bonusCap?.toString() || '10');
        setEditCountLimit(sp.countLimit?.toString() || '5');
      } catch { setEditBonusCap('10'); setEditCountLimit('5'); }
    }

    setIsEditDialogOpen(true);
  };

  const handleEditHomework = async () => {
    if (!editingHomework || !editTitle.trim() || !editDeadline) return;

    if (editingHomework.type === 'GROUP_PROJECT') {
      const min = parseInt(editGroupMinSize) || 2;
      const max = parseInt(editGroupMaxSize) || 6;
      if (min > max) {
        toast.error('小组最小人数不能大于最大人数');
        return;
      }
    }

    if (editAllowLate && !editLateDeadline) {
      toast.error('允许迟交时，请设置迟交截止时间');
      return;
    }
    if (editAllowLate && editLateDeadline && editDeadline && new Date(editLateDeadline) <= new Date(editDeadline)) {
      toast.error('迟交截止时间必须晚于正常截止时间');
      return;
    }

    try {
      const updateData: Partial<CreateHomeworkData> = {
        title: editTitle,
        description: editDescription,
        startTime: editStartTime ? new Date(editStartTime).toISOString() : undefined,
        deadline: new Date(editDeadline).toISOString(),
        maxScore: parseInt(editMaxScore) || 100,
        allowLate: editAllowLate,
        lateDeadline: editAllowLate && editLateDeadline ? new Date(editLateDeadline).toISOString() : undefined,
      };

      if (editingHomework.type === 'GROUP_PROJECT') {
        updateData.groupConfig = {
          groupRequired: true,
          minSize: parseInt(editGroupMinSize) || 2,
          maxSize: parseInt(editGroupMaxSize) || 6,
          groupDeadline: editGroupDeadline ? new Date(editGroupDeadline).toISOString() : undefined,
          allowSwitch: true,
          allowTeacherAssign: true,
          ungroupedPolicy: 'TEACHER_ASSIGN',
          scoringModel: 'BASE_PLUS_ADJUST',
        };
        updateData.peerReviewConfig = {
          reviewersPerSubmission: parseInt(editReviewersCount) || 3,
          reviewDeadline: editReviewDeadline ? new Date(editReviewDeadline).toISOString() : undefined,
          penaltyLevel: 'MEDIUM',
          anonymousMode: 'DOUBLE_BLIND',
          minReviewsRequired: parseInt(editReviewersCount) || 3,
          coverageStrategy: 'AUTO_SUPPLEMENT',
        };
      }

      if (editingHomework.type === 'SELF_PRACTICE') {
        updateData.selfPracticeConfig = {
          bonusCap: parseInt(editBonusCap) || 10,
          countLimit: parseInt(editCountLimit) || 5,
          qualityThreshold: 60,
          scoringStrategy: 'BONUS',
          antiCheatRules: ['每日提交上限3次', '需通过质量门槛审查', '教师可抽检'],
        };
      }

      await updateHomework(editingHomework.id, updateData);

      setIsEditDialogOpen(false);
      setEditingHomework(null);
      toast.success('作业更新成功');
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    }
  };

  // 加载文件预览
  const loadFilePreview = useCallback(async (homeworkId: string, filename: string) => {
    setPreviewLoading(true);
    setPreviewContent(null);
    try {
      const content = await previewFile(homeworkId, filename);
      setPreviewContent(content);
    } catch {
      setPreviewContent(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewFile]);
  
  // 导航到指定学生提交
  const navigateToSubmission = useCallback((index: number, submissions: Submission[]) => {
    const sub = submissions[index];
    if (!sub) return;
    setCurrentSubmissionIndex(index);
    setSelectedSubmission(sub);
    setGradeScore(sub.score?.toString() || '');
    setGradeFeedback(sub.feedback || '');
    setCurrentFileIndex(0);
    setPreviewContent(null);

    // 初始化小组成员分数
    if (sub.groupId && sub.group?.members) {
      const scores: Record<string, string> = {};
      const feedbacks: Record<string, string> = {};
      for (const member of sub.group.members) {
        const existing = sub.scoreAdjustments?.find(sa => sa.studentId === member.studentId);
        scores[member.studentId] = existing ? existing.finalScore.toString() : '';
        feedbacks[member.studentId] = existing?.reason || '';
      }
      setGroupMemberScores(scores);
      setGroupMemberFeedbacks(feedbacks);
    } else {
      setGroupMemberScores({});
      setGroupMemberFeedbacks({});
    }

    // 自动加载第一个文件预览
    if (selectedHomework && sub.files && sub.files.length > 0) {
      loadFilePreview(selectedHomework.id, sub.files[0]);
    }
  }, [selectedHomework, loadFilePreview]);

  const handleGrade = useCallback(async () => {
    if (!selectedHomework || !selectedSubmission || !gradeScore) return;
    
    const score = parseInt(gradeScore);
    if (score < 0 || score > selectedHomework.maxScore) {
      toast.error(`分数必须在 0-${selectedHomework.maxScore} 之间`);
      return;
    }
    
    try {
      await gradeSubmission(
        selectedHomework.id,
        selectedSubmission.id,
        { score, feedback: gradeFeedback },
      );
      
      toast.success('批改成功');
      // 更新本地状态以反映已批改
      const submissions = selectedHomework.submissions || [];
      const updatedSubmission = { ...selectedSubmission, score, feedback: gradeFeedback, gradedAt: new Date().toISOString() };
      setSelectedSubmission(updatedSubmission);
      
      // 刷新教师作业列表以保持数据一致
      fetchTeacherHomeworks();
      
      // 自动导航到下一个未批改的学生
      const nextUngraded = submissions.findIndex((s, i) => i > currentSubmissionIndex && s.score === null);
      if (nextUngraded >= 0) {
        navigateToSubmission(nextUngraded, submissions);
      }
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    }
  }, [selectedHomework, selectedSubmission, gradeScore, gradeFeedback, gradeSubmission, fetchTeacherHomeworks, currentSubmissionIndex, navigateToSubmission]);

  // 小组批改 - 给每个成员单独打分
  const handleGroupGrade = useCallback(async () => {
    if (!selectedHomework || !selectedSubmission) return;
    const members = selectedSubmission.group?.members || [];
    if (members.length === 0) return;

    // 验证所有成员都已填分
    const memberScores: { studentId: string; score: number; feedback?: string }[] = [];
    for (const member of members) {
      const scoreStr = groupMemberScores[member.studentId];
      if (!scoreStr || scoreStr.trim() === '') {
        toast.error(`请为 ${member.student.name} 输入分数`);
        return;
      }
      const score = parseInt(scoreStr);
      if (isNaN(score) || score < 0 || score > selectedHomework.maxScore) {
        toast.error(`${member.student.name} 的分数必须在 0-${selectedHomework.maxScore} 之间`);
        return;
      }
      memberScores.push({
        studentId: member.studentId,
        score,
        feedback: groupMemberFeedbacks[member.studentId] || undefined,
      });
    }

    try {
      await gradeGroupSubmission(selectedHomework.id, selectedSubmission.id, memberScores);
      toast.success('小组批改成功');
      fetchTeacherHomeworks();

      // 自动导航到下一个未批改的提交
      const submissions = selectedHomework.submissions || [];
      const nextUngraded = submissions.findIndex((s, i) => i > currentSubmissionIndex && s.score === null);
      if (nextUngraded >= 0) {
        navigateToSubmission(nextUngraded, submissions);
      }
    } catch {
      // 错误已由全局拦截器处理
    }
  }, [selectedHomework, selectedSubmission, groupMemberScores, groupMemberFeedbacks, gradeGroupSubmission, fetchTeacherHomeworks, currentSubmissionIndex, navigateToSubmission]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isGradingMode) return;
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S: Save grade
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (selectedSubmission?.groupId && selectedSubmission?.group) {
          handleGroupGrade();
        } else {
          handleGrade();
        }
      }
      // Alt+Left: Previous student
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentSubmissionIndex > 0) {
          navigateToSubmission(currentSubmissionIndex - 1, selectedHomework?.submissions || []);
        }
      }
      // Alt+Right: Next student  
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const subs = selectedHomework?.submissions || [];
        if (currentSubmissionIndex < subs.length - 1) {
          navigateToSubmission(currentSubmissionIndex + 1, subs);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isGradingMode, currentSubmissionIndex, selectedHomework, selectedSubmission, navigateToSubmission, handleGrade, handleGroupGrade]);

  const openGradeDialog = (homework: Homework, submission: Submission) => {
    const submissions = homework.submissions || [];
    const subIndex = submissions.findIndex(s => s.id === submission.id);
    setSelectedHomework(homework);
    setSelectedSubmission(submission);
    setCurrentSubmissionIndex(subIndex >= 0 ? subIndex : 0);
    setGradeScore(submission.score?.toString() || '');
    setGradeFeedback(submission.feedback || '');
    setCurrentFileIndex(0);
    setPreviewContent(null);
    setIsGradingMode(true);

    // 初始化小组成员分数（如果是小组作业提交）
    if (submission.groupId && submission.group?.members) {
      const scores: Record<string, string> = {};
      const feedbacks: Record<string, string> = {};
      for (const member of submission.group.members) {
        const existing = submission.scoreAdjustments?.find(sa => sa.studentId === member.studentId);
        scores[member.studentId] = existing ? existing.finalScore.toString() : '';
        feedbacks[member.studentId] = existing?.reason || '';
      }
      setGroupMemberScores(scores);
      setGroupMemberFeedbacks(feedbacks);
    } else {
      setGroupMemberScores({});
      setGroupMemberFeedbacks({});
    }

    // 加载第一个文件
    if (submission.files && submission.files.length > 0) {
      loadFilePreview(homework.id, submission.files[0]);
    }
  };

  const handleExport = async (homeworkId: string, format: 'csv' | 'json') => {
    try {
      await exportGrades(homeworkId, format);
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    }
  };

  const getStatusBadge = (homework: Homework) => {
    const now = new Date();
    const deadline = new Date(homework.deadline);
    const startTime = new Date(homework.startTime);
    
    if (now < startTime) {
      return <Badge variant="secondary">未开始</Badge>;
    } else if (now > deadline) {
      return <Badge className="bg-gray-100 text-gray-700">已截止</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-700">进行中</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">作业管理</h1>
          <p className="text-gray-600 mt-1">
            发布和管理作业，查看学生提交情况
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              发布作业
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                </div>
                发布新作业
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              {/* 基本信息区 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <FileText className="w-4 h-4 text-blue-500" />
                  基本信息
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="hw-title">作业标题 <span className="text-red-500">*</span></Label>
                    <Input
                      id="hw-title"
                      placeholder="例如：第三章练习题"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hw-desc">作业描述</Label>
                    <Textarea
                      id="hw-desc"
                      placeholder="详细描述作业要求、提交规范等..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>作业形态</Label>
                      <Select value={homeworkType} onValueChange={(val) => setHomeworkType(val as 'STANDARD' | 'GROUP_PROJECT' | 'SELF_PRACTICE')}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">📝 普通作业</SelectItem>
                          <SelectItem value="GROUP_PROJECT">👥 项目小组作业</SelectItem>
                          <SelectItem value="SELF_PRACTICE">🎯 自主实践作业</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>选择班级 <span className="text-red-500">*</span></Label>
                      <Select value={classId} onValueChange={setClassId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="请选择班级" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 项目小组配置 */}
              {homeworkType === 'GROUP_PROJECT' && (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-100/60 border-b border-blue-200">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">项目小组配置</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600">最小人数</Label>
                        <Input type="number" value={groupMinSize} onChange={(e) => setGroupMinSize(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600">最大人数</Label>
                        <Input type="number" value={groupMaxSize} onChange={(e) => setGroupMaxSize(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600">组队截止</Label>
                        <Input type="datetime-local" value={groupDeadline} onChange={(e) => setGroupDeadline(e.target.value)} className="h-9 text-xs" />
                      </div>
                    </div>
                    <Separator className="bg-blue-100" />
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                      <UserCheck className="w-3.5 h-3.5" />
                      互评配置
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600">每份作业评审人数</Label>
                        <Input type="number" value={reviewersCount} onChange={(e) => setReviewersCount(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600">互评截止时间</Label>
                        <Input type="datetime-local" value={reviewDeadline} onChange={(e) => setReviewDeadline(e.target.value)} className="h-9 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 自主实践配置 */}
              {homeworkType === 'SELF_PRACTICE' && (
                <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-green-50/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-emerald-100/60 border-b border-emerald-200">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">自主实践配置</span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600">加分上限</Label>
                        <Input type="number" value={bonusCap} onChange={(e) => setBonusCap(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-600">提交次数上限</Label>
                        <Input type="number" value={countLimit} onChange={(e) => setCountLimit(e.target.value)} className="h-9" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* 时间与评分区 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <CalendarClock className="w-4 h-4 text-orange-500" />
                  时间与评分
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hw-start">开始时间</Label>
                      <Input
                        id="hw-start"
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hw-deadline">截止时间 <span className="text-red-500">*</span></Label>
                      <Input
                        id="hw-deadline"
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hw-score" className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-yellow-500" />
                        满分
                      </Label>
                      <Input
                        id="hw-score"
                        type="number"
                        value={maxScore}
                        onChange={(e) => setMaxScore(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hw-reminder" className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-orange-400" />
                        提前提醒（小时）
                      </Label>
                      <Input
                        id="hw-reminder"
                        type="number"
                        value={reminderHours}
                        onChange={(e) => setReminderHours(e.target.value)}
                        placeholder="截止前X小时"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Settings2 className="w-3.5 h-3.5 text-gray-400" />
                        迟交设置
                      </Label>
                      <div className="flex items-center gap-2.5 h-9 px-3 rounded-md border border-input bg-background">
                        <Switch
                          id="allowLate"
                          checked={allowLate}
                          onCheckedChange={setAllowLate}
                        />
                        <Label htmlFor="allowLate" className="text-sm font-normal cursor-pointer">
                          允许迟交
                        </Label>
                      </div>
                    </div>
                  </div>
                  {allowLate && (
                    <div className="space-y-2 pl-6">
                      <Label htmlFor="hw-late-deadline" className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                        迟交截止时间 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="hw-late-deadline"
                        type="datetime-local"
                        value={lateDeadline}
                        onChange={(e) => setLateDeadline(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">允许迟交时，必须设置迟交截止时间</p>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 h-10 text-base font-medium mt-2"
                onClick={handleCreateHomework}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                发布作业
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 作业列表 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4">加载中...</p>
        </div>
      ) : homeworks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无作业，点击上方按钮发布</p>
        </div>
      ) : (
        <div className="space-y-4">
          {homeworks.map((homework) => (
            <Card key={homework.id}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">{homework.title}</CardTitle>
                      {homework.type === 'GROUP_PROJECT' && (
                        <Badge className="bg-blue-100 text-blue-700">项目小组</Badge>
                      )}
                      {homework.type === 'SELF_PRACTICE' && (
                        <Badge className="bg-green-100 text-green-700">自主实践</Badge>
                      )}
                      {getStatusBadge(homework)}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{homework.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(homework)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(homework.id, 'csv')}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      导出
                    </Button>
                    {homework.type === 'GROUP_PROJECT' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openGroupCenter(homework)}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        组队中心
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{homework.class?.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>截止：{new Date(homework.deadline).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileCheck className="w-4 h-4" />
                    <span>满分：{homework.maxScore}分</span>
                  </div>
                </div>

                {/* 提交情况 */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">
                      提交情况：{homework._count?.submissions || 0} 人提交
                    </span>
                  </div>
                  
                  {homework.submissions && homework.submissions.length > 0 ? (
                    <div className="space-y-2">
                      {homework.submissions.map((submission) => (
                        <div
                          key={submission.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${submission.groupId && submission.group ? 'bg-blue-50/50 border border-blue-100' : 'bg-gray-50'}`}
                        >
                          <div className="flex items-center gap-3">
                            {submission.groupId && submission.group ? (
                              <>
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                                  <Users className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium">{submission.group.name}</p>
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">{submission.group.members.length}人</Badge>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    提交于 {new Date(submission.submittedAt).toLocaleString('zh-CN')}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={submission.student?.avatar || undefined} />
                                  <AvatarFallback>{submission.student?.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{submission.student?.name}</p>
                                  <p className="text-xs text-gray-500">
                                    提交于 {new Date(submission.submittedAt).toLocaleString('zh-CN')}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {submission.score !== null ? (
                              <Badge className="bg-green-100 text-green-700">
                                {submission.groupId && submission.scoreAdjustments?.length ? `平均 ${submission.score}分` : `${submission.score}分`}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">待批改</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openGradeDialog(homework, submission)}
                            >
                              {submission.score !== null ? '修改分数' : '批改'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">暂无提交</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 批改专注模式 - 全屏沉浸式工作台 (Portal 到 body，确保完全覆盖视窗) */}
      {isGradingMode && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
          {/* 顶部导航栏 */}
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGradingMode(false)}
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                返回作业列表
              </Button>
              <span className="text-sm font-medium text-gray-600 truncate">
                {selectedHomework?.title}
              </span>
              {selectedHomework?.submissions && (
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {selectedHomework.submissions.filter(s => s.score !== null).length}/{selectedHomework.submissions.length} 已批改
                </span>
              )}
            </div>
          </div>

          {/* 主体左右分栏布局 */}
          <div className="flex-1 flex min-h-0">
            {/* 左侧预览区 - 约75% 宽度 */}
            <div className="flex-[3] flex flex-col min-w-0 border-r">
              {/* 文件标签页 */}
              {selectedSubmission?.files && selectedSubmission.files.length > 0 && (
                <div className="flex items-center justify-between px-2 bg-gray-50 border-b shrink-0">
                  <div className="flex items-center gap-0.5 overflow-x-auto py-1">
                    {selectedSubmission.files.map((file, index) => (
                      <button
                        key={index}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                          currentFileIndex === index
                            ? 'bg-white text-blue-700 font-medium shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          setCurrentFileIndex(index);
                          if (selectedHomework) {
                            loadFilePreview(selectedHomework.id, file);
                          }
                        }}
                      >
                        {getFileIcon(file)}
                        <span>{getFileName(file)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pl-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedHomework && selectedSubmission.files[currentFileIndex]) {
                          downloadFile(selectedHomework.id, selectedSubmission.files[currentFileIndex]);
                        }
                      }}
                      title="下载文件"
                      className="h-7 w-7 p-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (previewContent?.url) {
                          window.open(previewContent.url, '_blank');
                        }
                      }}
                      disabled={!previewContent?.url}
                      title="在新标签页打开"
                      className="h-7 w-7 p-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* 预览内容 */}
              <div className="flex-1 overflow-auto">
                {previewLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                      <p className="text-gray-500 mt-4">加载预览中...</p>
                    </div>
                  </div>
                ) : !selectedSubmission?.files || selectedSubmission.files.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <FileText className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-lg font-medium">该学生未提交文件</p>
                      <p className="text-sm mt-1">此学生尚未上传任何作业文件</p>
                    </div>
                  </div>
                ) : previewContent?.type === 'pdf' ? (
                  <PDFPreview url={previewContent.url!} />
                ) : previewContent?.type === 'ipynb' ? (
                  <NotebookPreview content={previewContent.content} />
                ) : previewContent === null && !previewLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <Eye className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-lg font-medium">选择文件以预览</p>
                      <p className="text-sm mt-1">点击上方文件标签开始预览</p>
                      {selectedSubmission?.files && selectedSubmission.files.length > 0 && (
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => {
                            if (selectedHomework && selectedSubmission.files[currentFileIndex]) {
                              loadFilePreview(selectedHomework.id, selectedSubmission.files[currentFileIndex]);
                            }
                          }}
                        >
                          加载预览
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">无法预览此文件格式</p>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧评分工具栏 - 约25% 宽度 */}
            <div className="flex-[1] min-w-[280px] max-w-[400px] bg-white flex flex-col">
              {/* 学生切换导航 */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentSubmissionIndex <= 0}
                      onClick={() => navigateToSubmission(currentSubmissionIndex - 1, selectedHomework?.submissions || [])}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      上一个
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Alt + ←</TooltipContent>
                </Tooltip>
                <span className="text-xs font-medium px-2 whitespace-nowrap truncate max-w-[120px]" title={selectedSubmission?.groupId && selectedSubmission?.group ? selectedSubmission.group.name : selectedSubmission?.student?.name}>
                  {selectedSubmission?.groupId && selectedSubmission?.group ? selectedSubmission.group.name : selectedSubmission?.student?.name}（{currentSubmissionIndex + 1}/{selectedHomework?.submissions?.length || 0}）
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentSubmissionIndex >= (selectedHomework?.submissions?.length || 1) - 1}
                      onClick={() => navigateToSubmission(currentSubmissionIndex + 1, selectedHomework?.submissions || [])}
                    >
                      下一个
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Alt + →</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* 学生/小组信息 */}
                  {selectedSubmission?.groupId && selectedSubmission?.group ? (
                    /* 小组提交信息 */
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-900">{selectedSubmission.group.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selectedSubmission.group.members.length} 人</Badge>
                      </div>
                      <p className="text-xs text-blue-700">小组提交</p>
                    </div>
                  ) : (
                    /* 个人提交信息 */
                    <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={selectedSubmission?.student?.avatar ?? undefined} />
                        <AvatarFallback>{selectedSubmission?.student?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{selectedSubmission?.student?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{selectedSubmission?.student?.email}</p>
                      </div>
                    </div>
                  )}

                  {/* 提交信息 */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>提交于 {selectedSubmission ? new Date(selectedSubmission.submittedAt).toLocaleString('zh-CN') : '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{selectedSubmission?.files?.length || 0} 个文件</span>
                    </div>
                    {selectedSubmission?.gradedAt && (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>已批改于 {new Date(selectedSubmission.gradedAt).toLocaleString('zh-CN')}</span>
                      </div>
                    )}
                  </div>

                  <hr className="border-gray-200" />

                  {/* 小组分工说明（仅小组提交且存在分工数据时显示） */}
                  {selectedSubmission?.groupId && selectedSubmission?.laborDivision && (() => {
                    const divisionItems = parseLaborDivision(selectedSubmission.laborDivision);
                    if (divisionItems.length === 0) return null;
                    return (
                      <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-100 space-y-2">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-800">
                          <Users className="w-4 h-4" />
                          <span>小组分工说明</span>
                        </div>
                        {divisionItems.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-blue-700">
                            <span className="font-medium shrink-0">{item.memberName || '未知成员'}:</span>
                            <span className="flex-1">{item.task || '-'}{item.description ? ` — ${item.description}` : ''}</span>
                            {item.contributionPercent != null && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                {item.contributionPercent}%
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 小组成员单独评分 或 个人评分 */}
                  {selectedSubmission?.groupId && selectedSubmission?.group ? (
                    /* 小组成员逐个评分 */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-gray-800">成员评分 (0-{selectedHomework?.maxScore})</label>
                        {/* 一键统一分数 */}
                        <div className="flex gap-1">
                          {[100, 90, 80, 60].filter(s => selectedHomework?.maxScore && s <= selectedHomework.maxScore).map((score) => (
                            <button
                              key={score}
                              onClick={() => {
                                const newScores: Record<string, string> = {};
                                for (const member of selectedSubmission.group!.members) {
                                  newScores[member.studentId] = score.toString();
                                }
                                setGroupMemberScores(newScores);
                              }}
                              className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                              title={`统一设为 ${score} 分`}
                            >
                              全{score}
                            </button>
                          ))}
                        </div>
                      </div>
                      {selectedSubmission.group.members.map((member) => {
                        const isLeader = member.role === 'LEADER';
                        const divisionItems = parseLaborDivision(selectedSubmission.laborDivision);
                        const memberDivision = divisionItems.find(d => d.memberId === member.studentId);
                        return (
                          <div key={member.studentId} className={`p-3 rounded-lg border transition-colors ${isLeader ? 'bg-amber-50/60 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center gap-2.5 mb-2">
                              <Avatar className="w-7 h-7">
                                <AvatarImage src={member.student.avatar ?? undefined} />
                                <AvatarFallback className="text-xs">{member.student.name?.[0]}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium truncate">{member.student.name}</span>
                                  {isLeader ? (
                                    <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 gap-0.5">
                                      <Crown className="w-3 h-3" />
                                      组长
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                                      <User className="w-3 h-3" />
                                      组员
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {/* 分数输入 */}
                              <Input
                                type="number"
                                value={groupMemberScores[member.studentId] || ''}
                                onChange={(e) => setGroupMemberScores(prev => ({ ...prev, [member.studentId]: e.target.value }))}
                                placeholder="分数"
                                min={0}
                                max={selectedHomework?.maxScore}
                                className="w-20 h-8 text-sm text-center"
                              />
                            </div>
                            {memberDivision && (
                              <div className="text-xs text-slate-500 mb-1.5 pl-9">
                                <span className="font-medium">分工:</span> {memberDivision.task || '-'}
                                {memberDivision.contributionPercent != null && (
                                  <span className="ml-1.5 text-blue-600 font-medium">({memberDivision.contributionPercent}%)</span>
                                )}
                                {memberDivision.description && (
                                  <span className="ml-1 text-slate-400">— {memberDivision.description}</span>
                                )}
                              </div>
                            )}
                            {/* 个人评语（可选，折叠展示） */}
                            <Input
                              value={groupMemberFeedbacks[member.studentId] || ''}
                              onChange={(e) => setGroupMemberFeedbacks(prev => ({ ...prev, [member.studentId]: e.target.value }))}
                              placeholder="个人评语（可选）"
                              className="h-7 text-xs mt-1"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* 个人评分（保持原有逻辑） */
                    <>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">分数 (0-{selectedHomework?.maxScore})</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={gradeScore}
                            onChange={(e) => setGradeScore(e.target.value)}
                            placeholder="输入分数"
                            min={0}
                            max={selectedHomework?.maxScore}
                            className="flex-1"
                          />
                          {/* Quick score buttons */}
                          <div className="flex gap-1">
                            {[100, 90, 80, 60].map((score) => (
                              selectedHomework?.maxScore && score <= selectedHomework.maxScore && (
                                <button
                                  key={score}
                                  onClick={() => setGradeScore(score.toString())}
                                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                                    gradeScore === score.toString()
                                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {score}
                                </button>
                              )
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 评语 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">评语</label>
                            <span className="text-xs text-gray-400">可选</span>
                          </div>
                          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={handleGenerateAIReview} disabled={isGeneratingAIReview}>
                            {isGeneratingAIReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WandSparkles className="w-3.5 h-3.5" />}
                            AI自动批改
                          </Button>
                        </div>
                        <Textarea
                          value={gradeFeedback}
                          onChange={(e) => setGradeFeedback(e.target.value)}
                          placeholder="输入详细的评语和反馈建议..."
                          rows={5}
                          className="resize-y min-h-[80px] text-sm"
                        />
                      </div>

                      {/* 快捷评语 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <MessageSquare className="w-3 h-3" />
                          <span>快捷评语</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {feedbackTemplates.map((tpl, i) => (
                            <button
                              key={i}
                              onClick={() => setGradeFeedback(prev => prev ? `${prev}\n${tpl}` : tpl)}
                              className="text-[11px] px-2 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors text-left"
                            >
                              {tpl.length > 20 ? tpl.slice(0, 20) + '...' : tpl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 底部固定保存按钮 */}
              <div className="p-3 border-t bg-white shrink-0 space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {selectedSubmission?.groupId && selectedSubmission?.group ? (
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                        onClick={handleGroupGrade}
                        disabled={!selectedSubmission?.group?.members?.every(m => groupMemberScores[m.studentId])}
                      >
                        <Save className="w-4 h-4" />
                        保存小组评分
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                        onClick={handleGrade}
                        disabled={!gradeScore}
                      >
                        <Save className="w-4 h-4" />
                        保存批改
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>Ctrl + S</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 编辑作业对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100">
                <Pencil className="w-4 h-4 text-amber-600" />
              </div>
              编辑作业
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* 基本信息区 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText className="w-4 h-4 text-blue-500" />
                基本信息
              </div>
              <div className="grid gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-hw-title">作业标题 <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-hw-title"
                    placeholder="例如：第三章练习题"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-hw-desc">作业描述</Label>
                  <Textarea
                    id="edit-hw-desc"
                    placeholder="详细描述作业要求、提交规范等..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 时间与评分区 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <CalendarClock className="w-4 h-4 text-orange-500" />
                时间与评分
              </div>
              <div className="grid gap-4 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-hw-start">开始时间</Label>
                    <Input
                      id="edit-hw-start"
                      type="datetime-local"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-hw-deadline">截止时间 <span className="text-red-500">*</span></Label>
                    <Input
                      id="edit-hw-deadline"
                      type="datetime-local"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-hw-score" className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-yellow-500" />
                      满分
                    </Label>
                    <Input
                      id="edit-hw-score"
                      type="number"
                      value={editMaxScore}
                      onChange={(e) => setEditMaxScore(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5 text-gray-400" />
                      迟交设置
                    </Label>
                    <div className="flex items-center gap-2.5 h-9 px-3 rounded-md border border-input bg-background">
                      <Switch
                        id="editAllowLate"
                        checked={editAllowLate}
                        onCheckedChange={setEditAllowLate}
                      />
                      <Label htmlFor="editAllowLate" className="text-sm font-normal cursor-pointer">
                        允许迟交
                      </Label>
                    </div>
                  </div>
                </div>
                {editAllowLate && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="edit-late-deadline" className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-orange-400" />
                      迟交截止时间
                    </Label>
                    <Input
                      id="edit-late-deadline"
                      type="datetime-local"
                      value={editLateDeadline}
                      onChange={(e) => setEditLateDeadline(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">允许迟交时，必须设置迟交截止时间</p>
                  </div>
                )}
              </div>
            </div>

            {/* 项目小组配置 */}
            {editingHomework?.type === 'GROUP_PROJECT' && (
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-100/60 border-b border-blue-200">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700">项目小组配置</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">最小人数</Label>
                      <Input type="number" value={editGroupMinSize} onChange={(e) => setEditGroupMinSize(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">最大人数</Label>
                      <Input type="number" value={editGroupMaxSize} onChange={(e) => setEditGroupMaxSize(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">组队截止</Label>
                      <Input type="datetime-local" value={editGroupDeadline} onChange={(e) => setEditGroupDeadline(e.target.value)} className="h-9 text-xs" />
                    </div>
                  </div>
                  <Separator className="bg-blue-100" />
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                    <UserCheck className="w-3.5 h-3.5" />
                    互评配置
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">每份作业评审人数</Label>
                      <Input type="number" value={editReviewersCount} onChange={(e) => setEditReviewersCount(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">互评截止时间</Label>
                      <Input type="datetime-local" value={editReviewDeadline} onChange={(e) => setEditReviewDeadline(e.target.value)} className="h-9 text-xs" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 自主实践配置 */}
            {editingHomework?.type === 'SELF_PRACTICE' && (
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-green-50/50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-100/60 border-b border-emerald-200">
                  <Target className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">自主实践配置</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">加分上限</Label>
                      <Input type="number" value={editBonusCap} onChange={(e) => setEditBonusCap(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">提交次数上限</Label>
                      <Input type="number" value={editCountLimit} onChange={(e) => setEditCountLimit(e.target.value)} className="h-9" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {editingHomework && (editingHomework._count?.submissions ?? 0) > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <Bell className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>已有 {editingHomework._count?.submissions} 位学生提交作业，修改不会影响已提交的内容。</span>
              </div>
            )}

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 h-10 text-base font-medium mt-2"
              onClick={handleEditHomework}
              disabled={!editTitle.trim() || !editDeadline}
            >
              <Save className="w-4 h-4 mr-1.5" />
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={isGroupCenterOpen} onOpenChange={setIsGroupCenterOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>作业动态组队中心{groupHomework ? ` - ${groupHomework.title}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">待分组学生（{unassignedStudents.length}）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[55vh] overflow-auto">
                {unassignedStudents.map((student) => (
                  <div
                    key={student.id}
                    draggable
                    onDragStart={() => setDragStudentId(student.id)}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2 cursor-grab"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Avatar className="h-8 w-8"><AvatarImage src={student.avatar} /><AvatarFallback>{student.name[0]}</AvatarFallback></Avatar>
                    <div className="min-w-0"><p className="text-sm font-medium truncate">{student.name}</p><p className="text-xs text-muted-foreground truncate">{student.email}</p></div>
                  </div>
                ))}
                {unassignedStudents.length === 0 && <p className="text-sm text-muted-foreground">全部学生已分组。</p>}
              </CardContent>
            </Card>
            <div className="lg:col-span-2 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">将左侧学生拖拽到右侧组卡，或使用自动分组。建议每组 {groupConfig?.minSize || 2}-{groupConfig?.maxSize || 6} 人。</p>
                <Button className="gap-2" onClick={handleAutoAssign} disabled={isAutoAssigning || !groupHomework}>
                  {isAutoAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}自动分组
                </Button>
              </div>
              <div className="grid md:grid-cols-2 gap-3 max-h-[55vh] overflow-auto pr-1">
                {groups.map((group) => (
                  <Card key={group.id} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDropToGroup(group.id)} className="border-dashed">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{group.name}（{group.members.length}人）</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {group.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 rounded-md bg-muted/30 p-2">
                          <Avatar className="h-7 w-7"><AvatarImage src={member.student.avatar} /><AvatarFallback>{member.student.name[0]}</AvatarFallback></Avatar>
                          <span className="text-sm">{member.student.name}</span>
                          {member.role === 'LEADER' && <Badge variant="secondary" className="ml-auto">组长</Badge>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
