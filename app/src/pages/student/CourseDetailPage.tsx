import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourseStore } from '@/stores/courseStore';
import { useChatStore } from '@/stores/chatStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import {
  Play,
  CheckCircle,
  Lock,
  ChevronRight,
  Download,
  Share2,
  MessageSquare,
  BookOpen,
  BarChart3,
  TrendingUp,
  Loader2,
  Send,
  Megaphone,
  LayoutGrid,
  List,
  Film,
  FileText,
  FolderOpen,
  Bot,
} from 'lucide-react';

export function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCourse, fetchCourseById, downloadSyllabus, isLoading, error } = useCourseStore();
  const { fetchModels, selectedModel } = useChatStore();

  const [aiInput, setAiInput] = useState('');
  const [aiSending, setAiSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    if (id) {
      fetchCourseById(id);
    }
  }, [id]);

  useEffect(() => {
    fetchModels();
  }, []);

  const handleContinueLearning = () => {
    if (!currentCourse?.modules?.length) {
      toast.info('暂无可学习的模块');
      return;
    }
    // Find the first incomplete module (IN_PROGRESS first, then first LOCKED)
    const inProgress = currentCourse.modules.find((m) => m.status === 'IN_PROGRESS');
    if (inProgress) {
      // Navigate to the module within this course
      navigate(`/courses/${id}#module-${inProgress.id}`);
      toast.info(`继续学习：${inProgress.title}`);
      return;
    }
    const locked = currentCourse.modules.find((m) => m.status === 'LOCKED');
    if (locked) {
      navigate(`/courses/${id}#module-${locked.id}`);
      toast.info(`下一模块：${locked.title}`);
      return;
    }
    toast.success('所有模块已完成！');
  };

  const handleDownloadSyllabus = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      await downloadSyllabus(id);
      toast.success('大纲下载成功');
    } catch {
      toast.error('下载大纲失败');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentCourse?.name || '课程分享',
          url,
        });
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('链接已复制到剪贴板');
      } catch {
        toast.error('复制链接失败');
      }
    }
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;
    if (!selectedModel) {
      toast.error('AI 模型未就绪，请稍后再试');
      return;
    }
    setAiSending(true);
    try {
      const context = currentCourse
        ? `学生正在学习课程「${currentCourse.name}」（课程代码：${currentCourse.code}），课程描述：${currentCourse.description}。当前进度 ${currentCourse.progress}%。`
        : undefined;
      // Navigate to AI assistant page with the question
      navigate(`/ai-assistant?q=${encodeURIComponent(aiInput)}${context ? `&ctx=${encodeURIComponent(context)}` : ''}`);
    } finally {
      setAiSending(false);
      setAiInput('');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'IN_PROGRESS':
        return (
          <button className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
            <Play className="w-7 h-7 text-blue-600 ml-0.5" />
          </button>
        );
      case 'LOCKED':
        return <Lock className="w-10 h-10 text-slate-300" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="text-green-600 text-xs font-bold uppercase border border-green-200 bg-green-50 px-2 py-1 rounded">
            已完成
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="text-blue-600 text-xs font-bold uppercase border border-blue-600/20 bg-blue-50 px-2 py-1 rounded">
            进行中
          </span>
        );
      case 'LOCKED':
        return (
          <span className="text-slate-400 text-xs font-bold uppercase border border-slate-200 bg-slate-50 px-2 py-1 rounded">
            未解锁
          </span>
        );
      default:
        return null;
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>首页</span>
          <ChevronRight className="w-4 h-4" />
          <span>我的课程</span>
          <ChevronRight className="w-4 h-4" />
          <span className="bg-slate-200 rounded w-24 h-4 inline-block animate-pulse" />
        </div>
        <div className="bg-gradient-to-br from-blue-700 to-blue-600 rounded-xl p-8 text-white">
          <div className="space-y-4">
            <div className="h-8 bg-blue-500/50 rounded w-48 animate-pulse" />
            <div className="h-6 bg-blue-500/50 rounded w-72 animate-pulse" />
            <div className="h-4 bg-blue-500/50 rounded w-64 animate-pulse" />
            <div className="h-2.5 bg-black/20 rounded-full w-full animate-pulse mt-6" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-5 bg-slate-200 rounded w-48 animate-pulse mb-3" />
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card>
              <CardContent className="p-5">
                <div className="h-5 bg-slate-200 rounded w-32 animate-pulse mb-4" />
                <div className="h-20 bg-slate-100 rounded animate-pulse" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !currentCourse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>首页</span>
          <ChevronRight className="w-4 h-4" />
          <span>我的课程</span>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {error || '课程未找到'}
            </h3>
            <p className="text-slate-500 mb-4">
              无法加载课程数据，请检查课程链接或稍后重试。
            </p>
            <Button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-700">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const course = currentCourse;

  return (
    <div className="space-y-6">
      {/* 面包屑 */}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-blue-600 transition-colors">首页</button>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <button onClick={() => navigate('/courses')} className="text-slate-500 hover:text-blue-600 transition-colors">我的课程</button>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-800 font-medium">{course.name}</span>
      </div>

      {/* 课程横幅 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-gradient-to-br from-blue-700 to-blue-600 rounded-xl p-6 lg:p-8 relative overflow-hidden shadow-lg shadow-blue-900/10">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />

        <div className="lg:col-span-8 flex flex-col justify-between gap-6 z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-1 rounded bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                {course.code}
              </span>
              {course.semester && (
                <span className="px-2 py-1 rounded bg-green-400/20 text-green-300 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                  {course.semester}
                </span>
              )}
            </div>
            <h1 className="text-white text-3xl sm:text-4xl font-black leading-tight tracking-tight">{course.name}</h1>
            <p className="text-blue-100 text-base sm:text-lg">
              {course.description}
              <br className="hidden sm:block" />
              讲师：<span className="text-white font-medium">{course.instructor}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex justify-between items-end">
              <p className="text-white text-sm font-medium">课程进度</p>
              <p className="text-white text-sm font-bold">已完成 {course.progress}%</p>
            </div>
            <div className="h-2.5 w-full bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${course.progress}%`, boxShadow: '0 0 10px rgba(255,255,255,0.5)' }}
              />
            </div>
            {course.modules && course.modules.length > 0 && (() => {
              const next = course.modules.find((m) => m.status === 'IN_PROGRESS') || course.modules.find((m) => m.status === 'LOCKED');
              return next ? (
                <p className="text-blue-100 text-xs mt-1">下一节：<span className="text-white font-medium">{next.title}</span></p>
              ) : null;
            })()}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-end items-start lg:items-end gap-4 z-10">
          <Button
            onClick={handleContinueLearning}
            className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-xl h-14 px-8 bg-white hover:bg-blue-50 text-blue-600 text-lg font-bold shadow-lg transition-all transform hover:scale-[1.02]"
          >
            <Play className="w-7 h-7" />
            <span>继续学习</span>
          </Button>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-blue-800/40 border border-white/20 hover:bg-blue-800/60 text-white text-sm font-medium transition-colors backdrop-blur-md"
              onClick={handleDownloadSyllabus}
              disabled={downloading}
            >
              {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              课程大纲
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-blue-800/40 border border-white/20 hover:bg-blue-800/60 text-white text-sm font-medium transition-colors backdrop-blur-md"
              onClick={handleShare}
            >
              <Share2 className="w-5 h-5" />
              分享
            </Button>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 课程模块 */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-800 text-xl font-bold">课程模块</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg border transition-colors shadow-sm ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'
                }`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg border transition-colors shadow-sm ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {course.modules?.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                暂无课程模块
              </CardContent>
            </Card>
          )}

          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'}>
            {course.modules?.map((module, idx) => (
              <div
                key={module.id}
                id={`module-${module.id}`}
                className={`bg-white rounded-xl overflow-hidden transition-colors shadow-sm ${
                  module.status === 'IN_PROGRESS'
                    ? 'border-2 border-blue-600 shadow-lg shadow-blue-500/10'
                    : module.status === 'LOCKED'
                    ? 'border border-slate-200 opacity-80'
                    : 'border border-slate-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-col md:flex-row'}`}>
                  {/* 左侧状态区 */}
                  <div className={`${
                    viewMode === 'grid' ? 'h-32' : 'w-full md:w-48 h-32 md:h-auto'
                  } bg-slate-50 relative shrink-0 flex items-center justify-center ${
                    viewMode === 'list' ? 'border-r border-slate-100' : 'border-b border-slate-100'
                  }`}>
                    {module.status === 'IN_PROGRESS' && (
                      <div className="absolute inset-0 bg-blue-600/10" />
                    )}
                    {getStatusIcon(module.status)}
                    <div className={`absolute bottom-2 right-2 px-2 py-0.5 ${
                      module.status === 'IN_PROGRESS' ? 'bg-black/60 text-white' : 'bg-white/80 text-slate-600 shadow-sm backdrop-blur'
                    } rounded text-xs font-mono`}>
                      第 {idx * 2 + 1}-{idx * 2 + 2} 周
                    </div>
                  </div>

                  {/* 右侧内容区 */}
                  <div className="p-5 flex flex-col justify-center flex-1 gap-2">
                    <div className="flex justify-between items-start">
                      <h4 className={`font-bold text-lg ${module.status === 'LOCKED' ? 'text-slate-400' : 'text-slate-800'}`}>
                        {module.title}
                      </h4>
                      {getStatusBadge(module.status)}
                    </div>
                    <p className={`text-sm line-clamp-2 ${module.status === 'LOCKED' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {module.description}
                    </p>

                    {module.status === 'IN_PROGRESS' && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                        <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '45%' }} />
                      </div>
                    )}

                    {module.status === 'LOCKED' && (
                      <p className="text-xs text-slate-400 mt-1">完成前一模块后解锁</p>
                    )}

                    {module.status === 'COMPLETED' && (
                      <div className="flex items-center gap-4 mt-2">
                        {module.videos.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Film className="w-3.5 h-3.5" />
                            {module.videos.length} 个视频
                          </div>
                        )}
                        {module.quizzes.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <FileText className="w-3.5 h-3.5" />
                            {module.quizzes.length} 次测验
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <FolderOpen className="w-3.5 h-3.5" />
                          学习资料
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧边栏 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* AI助教 */}
          <div className="bg-gradient-to-b from-blue-400 to-indigo-500 rounded-2xl p-[1px] shadow-lg shadow-blue-500/15">
            <div className="bg-white rounded-[15px] p-5 h-full flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center animate-pulse shadow-md">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-slate-800 font-bold text-sm">AI 助教</h4>
                    <p className="text-xs text-slate-500">在线 · 随时提供帮助</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 min-h-[100px] flex items-center justify-center text-center border border-slate-100">
                <p className="text-slate-500 text-sm italic">
                  "有什么关于本课程的问题？我可以帮你解答。"
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入问题..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
                  className="flex-1 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 px-3 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 placeholder:text-slate-400"
                />
                <button
                  onClick={handleAiSend}
                  disabled={aiSending || !aiInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  {aiSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* 积分评价 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-slate-800 font-bold">积分评价</h4>
              <button
                onClick={() => navigate('/student/analytics')}
                className="text-blue-600 text-xs font-bold hover:underline"
              >
                查看详情
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                  <path
                    className="text-slate-100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="text-yellow-500"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${course.progress}, 100`}
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                </svg>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <span className="text-slate-800 text-xs font-bold block">{course.progress}%</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 text-xs">课程进度</span>
                <span className="text-slate-800 font-bold text-lg">{course.progress}%</span>
                <span className="text-green-600 text-xs flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> 持续学习中
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">视频互动</span>
                  <span className="text-slate-800 font-medium">{course.progress >= 60 ? '高' : course.progress >= 30 ? '中' : '低'}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, course.progress + 10)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">模块完成率</span>
                  <span className="text-slate-800 font-medium">{course.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${course.progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 快捷入口 */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/resources')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all group shadow-sm text-left"
            >
              <div className="bg-orange-100 w-10 h-10 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-slate-800 font-bold text-sm">案例资源库</p>
              <p className="text-slate-500 text-xs">案例研究与数据集</p>
            </button>
            <button
              onClick={() => navigate('/student/analytics')}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all group shadow-sm text-left"
            >
              <div className="bg-cyan-100 w-10 h-10 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5 text-cyan-600" />
              </div>
              <p className="text-slate-800 font-bold text-sm">行为数据</p>
              <p className="text-slate-500 text-xs">行为模式分析</p>
            </button>
          </div>

          {/* 公告通知 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-blue-500" />
              公告通知
            </h4>
            {course.announcements && course.announcements.length > 0 ? (
              <div className="space-y-4">
                {course.announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`border-l-2 pl-3 ${ann.type === 'deadline' ? 'border-blue-600' : 'border-slate-300'}`}
                  >
                    <p className="text-slate-800 text-sm font-medium">{ann.title}</p>
                    <p className="text-slate-500 text-xs mt-1">{ann.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">暂无公告通知</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
