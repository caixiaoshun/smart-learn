import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useHomeworkStore, type Homework, type Submission, type CreateHomeworkData } from '@/stores/homeworkStore';
import { useClassStore } from '@/stores/classStore';
import { useResourceStore } from '@/stores/resourceStore';
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
  Trophy,
  Loader2,
  WandSparkles,
  GripVertical,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { NotebookPreview } from '@/components/NotebookPreview';

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
  const { homeworks, isLoading, fetchTeacherHomeworks, createHomework, updateHomework, gradeSubmission, exportGrades, previewFile, downloadFile } = useHomeworkStore();
  const { classes, fetchTeacherClasses } = useClassStore();
  const { createResourceFromHomework } = useResourceStore();
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

  // 批改状态
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  
  // 文件预览状态
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [previewContent, setPreviewContent] = useState<{ type: string; url?: string; content?: any } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // 学生导航索引
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);

  // 推荐到资源中心状态
  const [isAddToResourceOpen, setIsAddToResourceOpen] = useState(false);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceTags, setResourceTags] = useState('');
  const [resourceCategory, setResourceCategory] = useState('');
  const [isAddingToResource, setIsAddingToResource] = useState(false);
  const [selectedResourceFileKey, setSelectedResourceFileKey] = useState('');
  const [isGroupCenterOpen, setIsGroupCenterOpen] = useState(false);
  const [groupHomework, setGroupHomework] = useState<Homework | null>(null);
  const [dragStudentId, setDragStudentId] = useState<string | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isGeneratingAIReview, setIsGeneratingAIReview] = useState(false);

  // 获取可推荐的文件列表（仅 .ipynb 和 .pdf）
  const recommendableFiles = useMemo(() => {
    const files = selectedSubmission?.files || [];
    return files.filter((f: string) => {
      const ext = f.split('.').pop()?.toLowerCase();
      return ext === 'ipynb' || ext === 'pdf';
    });
  }, [selectedSubmission?.files]);

  const handleAddToResource = async () => {
    if (!selectedHomework || !selectedSubmission) return;
    if (!resourceTitle.trim() || !resourceDescription.trim()) {
      toast.error('请填写标题和描述');
      return;
    }
    if (resourceDescription.trim().length < 5) {
      toast.error('描述至少需要5个字');
      return;
    }

    const fileKey = selectedResourceFileKey;
    if (!fileKey) {
      toast.error('请选择要推荐的文件');
      return;
    }

    setIsAddingToResource(true);
    try {
      await createResourceFromHomework({
        title: resourceTitle.trim(),
        description: resourceDescription.trim(),
        homeworkId: selectedHomework.id,
        submissionId: selectedSubmission.id,
        fileKey,
        tags: resourceTags ? resourceTags.split(',').map(t => t.trim()).filter(Boolean) : [],
        category: resourceCategory || undefined,
      });
      toast.success('已成功添加到资源中心');
      setIsAddToResourceOpen(false);
      setResourceTitle('');
      setResourceDescription('');
      setResourceTags('');
      setResourceCategory('');
      setSelectedResourceFileKey('');
    } catch {
      // 错误已由全局拦截器处理
    } finally {
      setIsAddingToResource(false);
    }
  };

  const openAddToResourceDialog = () => {
    if (recommendableFiles.length === 0) {
      toast.error('该提交没有可推荐的文件（仅支持 .ipynb 和 .pdf 文件）');
      return;
    }
    // 预填写标题和描述
    const studentName = selectedSubmission?.student?.name || '学生';
    const hwTitle = selectedHomework?.title || '作业';
    setResourceTitle(`${hwTitle} - ${studentName}优秀作业`);
    setResourceDescription(`来自 ${studentName} 提交的优秀作业"${hwTitle}"，可作为学习参考。`);
    setResourceTags('');
    setResourceCategory('');
    // 默认选中当前预览的文件（如果是可推荐的），否则选第一个可推荐文件
    const currentFile = selectedSubmission?.files?.[currentFileIndex] || '';
    if (recommendableFiles.includes(currentFile)) {
      setSelectedResourceFileKey(currentFile);
    } else {
      setSelectedResourceFileKey(recommendableFiles[0]);
    }
    setIsAddToResourceOpen(true);
  };
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

  const handleCreateHomework = async () => {
    if (!title.trim() || !classId || !deadline) return;
    
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
    setIsEditDialogOpen(true);
  };

  const handleEditHomework = async () => {
    if (!editingHomework || !editTitle.trim() || !editDeadline) return;

    try {
      await updateHomework(editingHomework.id, {
        title: editTitle,
        description: editDescription,
        startTime: editStartTime ? new Date(editStartTime).toISOString() : undefined,
        deadline: new Date(editDeadline).toISOString(),
        maxScore: parseInt(editMaxScore) || 100,
        allowLate: editAllowLate,
      });

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

  // Keyboard shortcuts
  useEffect(() => {
    if (!isGradingMode) return;
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S: Save grade
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleGrade();
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
  }, [isGradingMode, currentSubmissionIndex, selectedHomework, navigateToSubmission, handleGrade]);

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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>发布新作业</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium">作业标题</label>
                <Input
                  placeholder="例如：第三章练习题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">作业描述</label>
                <Textarea
                  placeholder="详细描述作业要求..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">作业形态</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  value={homeworkType}
                  onChange={(e) => setHomeworkType(e.target.value as any)}
                >
                  <option value="STANDARD">普通作业</option>
                  <option value="GROUP_PROJECT">项目小组作业</option>
                  <option value="SELF_PRACTICE">自主实践作业</option>
                </select>
              </div>

              {homeworkType === 'GROUP_PROJECT' && (
                <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-blue-700">项目小组配置</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">最小人数</label>
                      <Input type="number" value={groupMinSize} onChange={(e) => setGroupMinSize(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">最大人数</label>
                      <Input type="number" value={groupMaxSize} onChange={(e) => setGroupMaxSize(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600">组队截止时间</label>
                    <Input type="datetime-local" value={groupDeadline} onChange={(e) => setGroupDeadline(e.target.value)} />
                  </div>
                  <p className="text-sm font-medium text-blue-700 mt-2">互评配置</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">每份作业评审人数</label>
                      <Input type="number" value={reviewersCount} onChange={(e) => setReviewersCount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">互评截止时间</label>
                      <Input type="datetime-local" value={reviewDeadline} onChange={(e) => setReviewDeadline(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {homeworkType === 'SELF_PRACTICE' && (
                <div className="p-3 bg-green-50 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-green-700">自主实践配置</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">加分上限</label>
                      <Input type="number" value={bonusCap} onChange={(e) => setBonusCap(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">提交次数上限</label>
                      <Input type="number" value={countLimit} onChange={(e) => setCountLimit(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">选择班级</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">请选择班级</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">开始时间</label>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">截止时间</label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">满分</label>
                  <Input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">提前提醒（小时）</label>
                  <Input
                    type="number"
                    value={reminderHours}
                    onChange={(e) => setReminderHours(e.target.value)}
                    placeholder="截止前X小时"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowLate"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="allowLate" className="text-sm">允许迟交</label>
              </div>
              
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleCreateHomework}
                disabled={!title.trim() || !classId || !deadline}
              >
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
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
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
                          </div>
                          <div className="flex items-center gap-2">
                            {submission.score !== null ? (
                              <Badge className="bg-green-100 text-green-700">
                                {submission.score}分
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
                <span className="text-xs font-medium px-2 whitespace-nowrap truncate max-w-[120px]" title={selectedSubmission?.student?.name}>
                  {selectedSubmission?.student?.name}（{currentSubmissionIndex + 1}/{selectedHomework?.submissions?.length || 0}）
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
                  {/* 学生信息 */}
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

                  {/* 分数 */}
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
                </div>
              </div>

              {/* 底部固定保存按钮 */}
              <div className="p-3 border-t bg-white shrink-0 space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                      onClick={handleGrade}
                      disabled={!gradeScore}
                    >
                      <Save className="w-4 h-4" />
                      保存批改
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ctrl + S</TooltipContent>
                </Tooltip>
                {recommendableFiles.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={openAddToResourceDialog}
                  >
                    <Trophy className="w-4 h-4" />
                    推荐到资源中心
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 编辑作业对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑作业</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">作业标题</label>
              <Input
                placeholder="例如：第三章练习题"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">作业描述</label>
              <Textarea
                placeholder="详细描述作业要求..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始时间</label>
                <Input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">截止时间</label>
                <Input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">满分</label>
                <Input
                  type="number"
                  value={editMaxScore}
                  onChange={(e) => setEditMaxScore(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editAllowLate"
                checked={editAllowLate}
                onChange={(e) => setEditAllowLate(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="editAllowLate" className="text-sm">允许迟交</label>
            </div>

            {editingHomework && (editingHomework._count?.submissions ?? 0) > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ 已有 {editingHomework._count?.submissions} 位学生提交作业，修改不会影响已提交的内容。
              </p>
            )}

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleEditHomework}
              disabled={!editTitle.trim() || !editDeadline}
            >
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

      {/* 推荐到资源中心对话框 */}
      <Dialog open={isAddToResourceOpen} onOpenChange={setIsAddToResourceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>推荐到资源中心</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p>将选中的文件作为优秀作业添加到资源中心，供其他学生参考学习。仅支持 Jupyter Notebook (.ipynb) 和 PDF (.pdf) 文件。</p>
            </div>

            {/* 文件选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">选择文件</label>
              {recommendableFiles.length === 1 ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border text-sm">
                  {getFileIcon(recommendableFiles[0])}
                  <span>{getFileName(recommendableFiles[0])}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {recommendableFiles.map((file: string) => (
                    <button
                      key={file}
                      onClick={() => setSelectedResourceFileKey(file)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                        selectedResourceFileKey === file
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {getFileIcon(file)}
                      <span>{getFileName(file)}</span>
                      {selectedResourceFileKey === file && (
                        <span className="ml-auto text-xs text-amber-600 font-medium">已选</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">资源标题</label>
              <Input
                placeholder="例如：优秀作业 - 数据预处理实验"
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">资源描述</label>
              <Textarea
                placeholder="描述这份作业的亮点..."
                value={resourceDescription}
                onChange={(e) => setResourceDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">标签</label>
              <Input
                placeholder="用逗号分隔，例如：优秀作业, Python, 数据分析"
                value={resourceTags}
                onChange={(e) => setResourceTags(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">分类</label>
              <Input
                placeholder="例如：数据预处理"
                value={resourceCategory}
                onChange={(e) => setResourceCategory(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsAddToResourceOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 gap-2"
                onClick={handleAddToResource}
                disabled={isAddingToResource || !resourceTitle.trim() || !resourceDescription.trim() || !selectedResourceFileKey}
              >
                {isAddingToResource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                添加到资源中心
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
