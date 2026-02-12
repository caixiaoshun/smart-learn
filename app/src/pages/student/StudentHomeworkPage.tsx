import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useHomeworkStore, type StudentHomework } from '@/stores/homeworkStore';
import { useClassStore } from '@/stores/classStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Clock, 
  Upload, 
  AlertCircle,
  Trash2,
  UserPlus,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Users,
  Download,
  KeyRound,
  BookOpen,
  LogOut,
  GraduationCap,
} from 'lucide-react';

export function StudentHomeworkPage() {
  const navigate = useNavigate();
  const { user, fetchUser } = useAuthStore();
  const { studentHomeworks, isLoading, fetchStudentHomeworks, submitHomework, downloadFile } = useHomeworkStore();
  const { joinClass, leaveClass, studentClasses, fetchStudentClasses } = useClassStore();
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(null);
  const [submittingHomeworkId, setSubmittingHomeworkId] = useState<string | null>(null);
  const [resubmittingHomeworkId, setResubmittingHomeworkId] = useState<string | null>(null);
  const [expandedHomeworkId, setExpandedHomeworkId] = useState<string | null>(null);
  
  // 加入班级相关状态
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentHomeworks();
    fetchStudentClasses();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, homeworkId: string) => {
    const files = Array.from(e.target.files || []);
    
    // 验证文件类型
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ext === 'pdf' || ext === 'ipynb';
    });
    
    if (validFiles.length !== files.length) {
      toast.error('只允许上传 PDF 或 Jupyter Notebook (.ipynb) 文件');
    }
    
    if (selectedHomeworkId === homeworkId) {
      setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 5));
    } else {
      setSelectedHomeworkId(homeworkId);
      setSelectedFiles(validFiles.slice(0, 5));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (homeworkId: string) => {
    if (selectedFiles.length === 0 || selectedHomeworkId !== homeworkId) return;
    
    setSubmittingHomeworkId(homeworkId);
    
    try {
      await submitHomework(homeworkId, selectedFiles);
      setSelectedFiles([]);
      setSelectedHomeworkId(null);
      setResubmittingHomeworkId(null);
      toast.success('作业提交成功！');
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    } finally {
      setSubmittingHomeworkId(null);
    }
  };

  const handleJoinClass = async () => {
    if (!inviteCode.trim()) return;
    
    setJoinLoading(true);
    try {
      await joinClass(inviteCode.toUpperCase());
      await fetchUser(); // 刷新用户信息以获取新的班级列表
      setJoinDialogOpen(false);
      setInviteCode('');
      toast.success('加入班级成功！');
      fetchStudentHomeworks(); // 刷新作业列表
      fetchStudentClasses(); // 刷新班级列表
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeaveClass = async (classId: string, className: string) => {
    if (!confirm(`确定要退出班级「${className}」吗？退出后将无法查看该班级的作业。`)) return;
    
    setLeaveLoading(classId);
    try {
      await leaveClass(classId);
      await fetchUser();
      toast.success('已退出班级');
      fetchStudentHomeworks();
      fetchStudentClasses();
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    } finally {
      setLeaveLoading(null);
    }
  };

  const getStatusBadge = (homework: StudentHomework) => {
    if (homework.isSubmitted && homework.mySubmission) {
      if (homework.mySubmission.score !== null && homework.mySubmission.score !== undefined) {
        return <Badge className="bg-green-100 text-green-700 border-green-200">已批改 {homework.mySubmission.score}分</Badge>;
      }
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">已提交</Badge>;
    }
    
    if (homework.isOverdue) {
      return <Badge className="bg-red-100 text-red-700 border-red-200">已截止</Badge>;
    }
    
    const now = new Date();
    const deadline = new Date(homework.deadline);
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursLeft < 24) {
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">即将截止</Badge>;
    }
    
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200">待提交</Badge>;
  };

  const getDeadlineInfo = (homework: StudentHomework) => {
    if (homework.isSubmitted) return { color: 'text-slate-500', text: '' };
    if (homework.isOverdue) return { color: 'text-red-600', text: '' };
    
    const now = new Date();
    const deadline = new Date(homework.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    
    if (diffMs <= 0) return { color: 'text-red-600', text: '' };
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let countdown = '';
    if (days > 0) countdown = `${String(days).padStart(2, '0')}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    else countdown = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    const hoursLeft = diffMs / (1000 * 60 * 60);
    if (hoursLeft < 24) return { color: 'text-yellow-600', text: countdown };
    return { color: 'text-blue-600', text: countdown };
  };

  const pendingHomeworks = studentHomeworks.filter(h => !h.isSubmitted && !h.isOverdue);
  const submittedHomeworks = studentHomeworks.filter(h => h.isSubmitted);
  const overdueHomeworks = studentHomeworks.filter(h => !h.isSubmitted && h.isOverdue);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">我的作业</h1>
          <p className="text-slate-500 mt-1">查看和提交课程作业</p>
        </div>
        <Button
          className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
          onClick={() => setJoinDialogOpen(true)}
        >
          <UserPlus className="w-4 h-4" />
          加入班级
        </Button>
      </div>

      {/* 我的班级 */}
      {studentClasses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              我的班级
            </h2>
            <Button variant="ghost" size="sm" className="gap-1 text-slate-500" onClick={() => fetchStudentClasses()}>
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {studentClasses.map((cls) => (
              <Card key={cls.id} className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{cls.name}</p>
                      {cls.teacher && (
                        <p className="text-xs text-slate-500 mt-0.5">教师：{cls.teacher.name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{cls._count?.students || 0} 名同学</span>
                        <span className="inline-flex items-center gap-1"><BookOpen className="w-3 h-3" />{cls._count?.homeworks || 0} 份作业</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 gap-1 text-xs"
                      onClick={() => handleLeaveClass(cls.id, cls.name)}
                      disabled={leaveLoading === cls.id}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {leaveLoading === cls.id ? '退出中...' : '退出班级'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 作业列表 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-500 mt-4">加载中...</p>
        </div>
      ) : !user?.classes || user.classes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium text-lg">您尚未加入班级</p>
          <p className="text-sm text-slate-400 mt-2">请联系老师获取班级邀请码</p>
          <Button 
            className="mt-6 gap-2 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
            onClick={() => setJoinDialogOpen(true)}
          >
            <UserPlus className="w-4 h-4" />
            加入班级
          </Button>
        </div>
      ) : studentHomeworks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">暂无作业</p>
        </div>
      ) : (
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="pending" className="gap-1.5 text-sm">
              <Clock className="w-3.5 h-3.5" />
              待提交
              {pendingHomeworks.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{pendingHomeworks.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="submitted" className="gap-1.5 text-sm">
              <FileText className="w-3.5 h-3.5" />
              已提交
              {submittedHomeworks.length > 0 && (
                <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{submittedHomeworks.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="overdue" className="gap-1.5 text-sm">
              <AlertCircle className="w-3.5 h-3.5" />
              已截止
              {overdueHomeworks.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{overdueHomeworks.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 待提交 */}
          <TabsContent value="pending">
            {pendingHomeworks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">没有待提交的作业</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingHomeworks.map(homework => renderHomeworkCard(homework))}
              </div>
            )}
          </TabsContent>

          {/* 已提交 */}
          <TabsContent value="submitted">
            {submittedHomeworks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">暂无已提交作业</p>
              </div>
            ) : (
              <div className="space-y-4">
                {submittedHomeworks.map(homework => renderHomeworkCard(homework))}
              </div>
            )}
          </TabsContent>

          {/* 已截止 */}
          <TabsContent value="overdue">
            {overdueHomeworks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">没有已截止的作业</p>
              </div>
            ) : (
              <div className="space-y-4">
                {overdueHomeworks.map(homework => renderHomeworkCard(homework))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* 加入班级对话框 */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="w-5 h-5 text-blue-600" />
              加入班级
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-500">请输入由任课教师提供的 6 位班级邀请码</p>
            <div className="space-y-2">
              <Input
                placeholder="输入邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-lg font-mono tracking-widest h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 text-center">不知道邀请码？请询问您的任课老师</p>
            </div>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 h-11 shadow-md shadow-blue-200"
              onClick={handleJoinClass}
              disabled={inviteCode.length !== 6 || joinLoading}
            >
              {joinLoading ? '加入中...' : '申请加入'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderHomeworkCard(homework: StudentHomework) {
    const isExpanded = expandedHomeworkId === homework.id;
    const deadlineInfo = getDeadlineInfo(homework);
    const isSubmitArea = homework.type !== 'GROUP_PROJECT' && ((!homework.isSubmitted && !homework.isOverdue) || resubmittingHomeworkId === homework.id);

    return (
      <Card key={homework.id} className="bg-white border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        {/* 顶部彩条 */}
        <div className={`h-1 w-full ${
          homework.isSubmitted && homework.mySubmission?.score != null
            ? 'bg-gradient-to-r from-green-400 to-emerald-300'
            : homework.isSubmitted
              ? 'bg-gradient-to-r from-blue-400 to-blue-300'
              : homework.isOverdue
                ? 'bg-gradient-to-r from-red-400 to-red-300'
                : 'bg-gradient-to-r from-blue-500 to-blue-300'
        }`} />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <CardTitle className="text-lg text-slate-900">{homework.title}</CardTitle>
                {homework.type === 'GROUP_PROJECT' && (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                    <Users className="w-3 h-3" />
                    小组作业
                  </Badge>
                )}
                {homework.type === 'SELF_PRACTICE' && (
                  <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
                    <BookOpen className="w-3 h-3" />
                    自主实践
                  </Badge>
                )}
                {getStatusBadge(homework)}
              </div>
              {homework.class && (
                <p className="text-xs text-slate-400 mb-1">{homework.class.name}</p>
              )}
            </div>

            {/* 截止倒计时 */}
            {!homework.isSubmitted && !homework.isOverdue && deadlineInfo.text && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <Clock className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">距离截止</div>
                  <div className={`text-sm font-bold tabular-nums ${deadlineInfo.color}`}>{deadlineInfo.text}</div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* 截止时间 & 满分 */}
          <div className="flex items-center gap-4 mb-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>截止：{new Date(homework.deadline).toLocaleString('zh-CN')}</span>
            </div>
            {homework.maxScore && (
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded border border-slate-200">
                满分：{homework.maxScore}分
              </span>
            )}
          </div>

          {/* 作业描述（可展开） */}
          {homework.description && (
            <div className="mb-4">
              <button
                onClick={() => setExpandedHomeworkId(isExpanded ? null : homework.id)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {isExpanded ? '收起详情' : '查看作业详情'}
              </button>
              {isExpanded && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {homework.description}
                </div>
              )}
            </div>
          )}

          {/* 小组作业 - 组队中心入口 */}
          {homework.type === 'GROUP_PROJECT' && (
            <div className="mb-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">小组组队</p>
                    <p className="text-xs text-blue-600">创建或加入小组，与队友协作完成作业</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                  onClick={() => navigate(`/homeworks/${homework.id}/group`)}
                >
                  <Users className="w-3.5 h-3.5" />
                  进入组队中心
                </Button>
              </div>
            </div>
          )}

          {/* 已提交的文件 */}
          {homework.isSubmitted && homework.mySubmission && (
            <div className="mb-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
              <p className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                已提交文件
              </p>
              <div className="space-y-2">
                {(homework.mySubmission.files ?? []).map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-green-100">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-700">{file}</span>
                    </div>
                    <button
                      onClick={() => downloadFile(homework.id, file)}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 提交时间 */}
              {homework.mySubmission.submittedAt && (
                <p className="text-xs text-green-600 mt-2">
                  提交时间：{new Date(homework.mySubmission.submittedAt).toLocaleString('zh-CN')}
                </p>
              )}

              {/* 已批改：显示分数和评语 */}
              {homework.mySubmission.score != null ? (
                <div className="mt-3 space-y-2">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-800">成绩：
                      <span className="text-xl font-bold ml-1">{homework.mySubmission.score}</span>
                      <span className="text-sm text-blue-600 ml-1">/ {homework.maxScore ?? 100}</span>
                    </p>
                  </div>
                  {homework.mySubmission.feedback && (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <p className="text-sm font-semibold text-yellow-800 mb-1">教师评语</p>
                      <p className="text-sm text-yellow-700">{homework.mySubmission.feedback}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* 未批改：显示重新提交按钮（非小组作业） */
                !homework.isOverdue && homework.type !== 'GROUP_PROJECT' && resubmittingHomeworkId !== homework.id && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => {
                        setResubmittingHomeworkId(homework.id);
                        setSelectedHomeworkId(homework.id);
                        setSelectedFiles([]);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      重新提交
                    </Button>
                  </div>
                )
              )}
            </div>
          )}

          {/* 提交区域（首次提交或重新提交） */}
          {isSubmitArea && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group bg-slate-50/50">
                <input
                  type="file"
                  id={`file-${homework.id}`}
                  multiple
                  accept=".pdf,.ipynb"
                  onChange={(e) => handleFileSelect(e, homework.id)}
                  className="hidden"
                />
                <label
                  htmlFor={`file-${homework.id}`}
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-10 h-10 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-blue-600">点击上传</span>
                  <span className="text-xs text-slate-400 mt-1">或拖拽文件至此</span>
                  <span className="text-xs text-slate-400 mt-1">支持 PDF、Jupyter Notebook (.ipynb)，最多5个文件</span>
                </label>
              </div>

              {/* 已选择的文件 */}
              {selectedFiles.length > 0 && selectedHomeworkId === homework.id && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <div className="truncate">
                          <span className="text-sm font-medium text-slate-700">{file.name}</span>
                          <span className="text-xs text-slate-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="flex-shrink-0 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                {resubmittingHomeworkId === homework.id && (
                  <Button
                    variant="ghost"
                    className="text-slate-500"
                    onClick={() => {
                      setResubmittingHomeworkId(null);
                      setSelectedFiles([]);
                      setSelectedHomeworkId(null);
                    }}
                  >
                    取消
                  </Button>
                )}
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 gap-2"
                  onClick={() => handleSubmit(homework.id)}
                  disabled={(selectedFiles.length === 0 || selectedHomeworkId !== homework.id) || submittingHomeworkId !== null}
                >
                  <Send className="w-4 h-4" />
                  {submittingHomeworkId === homework.id
                    ? '提交中...'
                    : resubmittingHomeworkId === homework.id
                      ? '重新提交作业'
                      : '提交作业'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
}
