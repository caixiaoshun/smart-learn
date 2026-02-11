import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useResourceStore } from '@/stores/resourceStore';
import { useCaseStore } from '@/stores/caseStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Play,
  Code,
  BookOpen,
  FileText,
  ChevronRight,
  Clock,
  Eye,
  Trophy,
  LayoutGrid,
  Bookmark,
  BookmarkCheck,
  Star,
  Sparkles,
  Upload,
  GraduationCap,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Flame,
} from 'lucide-react';

export function ResourceLibraryPage() {
  const { resources, fetchResources, loadMoreResources, createResource, pagination: resourcesPagination, isLoading: resourcesLoading, bookmarkResource, unbookmarkResource } = useResourceStore();
  const { cases, fetchCases, bookmarkCase, unbookmarkCase, isLoading: casesLoading } = useCaseStore();
  const isLoading = resourcesLoading || casesLoading;
  const { token, isAuthenticated } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resourceGridRef = useRef<HTMLDivElement>(null);
  
  // 筛选状态
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [activeTag, setActiveTag] = useState('不限');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortOrder, setSortOrder] = useState('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  
  // 知识点筛选
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([]);
  // 思政主题筛选
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  
  // 收藏状态
  const [bookmarkedResources, setBookmarkedResources] = useState<Set<string>>(new Set());
  const [bookmarkedCases, setBookmarkedCases] = useState<Set<string>>(new Set());
  const [bookmarkLoading, setBookmarkLoading] = useState<string | null>(null);
  
  // 侧边栏过滤模式
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'bookmarks' | 'recent'>('all');

  // 上传资源对话框状态
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadType, setUploadType] = useState<string>('NOTEBOOK');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTags, setUploadTags] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadResource = async () => {
    if (!uploadTitle.trim() || !uploadDescription.trim()) {
      toast.error('请填写标题和描述');
      return;
    }
    if (uploadDescription.trim().length < 5) {
      toast.error('描述至少需要5个字');
      return;
    }

    setIsUploading(true);
    try {
      await createResource({
        title: uploadTitle.trim(),
        description: uploadDescription.trim(),
        type: uploadType,
        file: uploadFile || undefined,
        tags: uploadTags ? uploadTags.split(',').map(t => t.trim()).filter(Boolean) : [],
        category: uploadCategory || undefined,
      });
      toast.success('资源上传成功');
      setIsUploadDialogOpen(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadType('NOTEBOOK');
      setUploadFile(null);
      setUploadTags('');
      setUploadCategory('');
      loadResources();
    } catch {
      // 错误已由全局拦截器处理
    } finally {
      setIsUploading(false);
    }
  };

  // 加载数据
  const loadResources = useCallback(() => {
    const typeMap: Record<string, string> = {
      'all': '',
      'video': 'VIDEO',
      'demo': 'DEMONSTRATION',
      'notebook': 'NOTEBOOK',
      'case': 'CASE',
      'homework': 'HOMEWORK',
    };
    
    fetchResources({
      type: typeMap[activeType] || undefined,
      category: selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints[0] : undefined,
      tag: activeTag !== '不限' ? activeTag : undefined,
      search: searchQuery || undefined,
      sort: sortOrder,
      order: 'desc',
      page: currentPage,
      limit: 12,
    });
  }, [activeType, activeTag, searchQuery, sortOrder, currentPage, selectedKnowledgePoints, fetchResources]);

  const loadCases = useCallback(() => {
    fetchCases({
      category: selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints[0] : undefined,
      theme: selectedThemes.length > 0 ? selectedThemes[0] : undefined,
      search: searchQuery || undefined,
      sort: sortOrder,
      order: 'desc',
      page: 1,
      limit: 6,
    });
  }, [selectedKnowledgePoints, selectedThemes, searchQuery, sortOrder, fetchCases]);

  useEffect(() => {
    loadResources();
    loadCases();
  }, [loadResources, loadCases]);

  // 处理搜索
  const handleSearch = () => {
    setCurrentPage(1);
    loadResources();
    loadCases();
  };

  // 处理类型切换
  const handleTypeChange = (typeId: string) => {
    setActiveType(typeId);
    setCurrentPage(1);
  };

  // 处理分类切换
  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    if (catId !== 'all') {
      setActiveType(catId);
    } else {
      setActiveType('all');
    }
    setCurrentPage(1);
  };

  // 处理标签切换
  const handleTagChange = (tagName: string) => {
    setActiveTag(tagName);
    setCurrentPage(1);
  };

  // 处理知识点筛选
  const handleKnowledgePointChange = (pointName: string) => {
    setSelectedKnowledgePoints(prev => {
      if (prev.includes(pointName)) {
        return prev.filter(p => p !== pointName);
      } else {
        return [...prev, pointName];
      }
    });
    setCurrentPage(1);
  };

  // 处理主题筛选
  const handleThemeChange = (themeName: string) => {
    setSelectedThemes(prev => {
      if (prev.includes(themeName)) {
        return prev.filter(t => t !== themeName);
      } else {
        return [...prev, themeName];
      }
    });
  };

  // 处理资源收藏
  const handleResourceBookmark = async (resourceId: string) => {
    if (!isAuthenticated || !token) {
      toast.error('请先登录');
      return;
    }
    
    setBookmarkLoading(resourceId);
    try {
      if (bookmarkedResources.has(resourceId)) {
        await unbookmarkResource(resourceId);
        setBookmarkedResources(prev => {
          const newSet = new Set(prev);
          newSet.delete(resourceId);
          return newSet;
        });
      } else {
        await bookmarkResource(resourceId);
        setBookmarkedResources(prev => new Set(prev).add(resourceId));
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
    } finally {
      setBookmarkLoading(null);
    }
  };

  // 处理案例收藏
  const handleCaseBookmark = async (caseId: string) => {
    if (!isAuthenticated || !token) {
      toast.error('请先登录');
      return;
    }
    
    setBookmarkLoading(caseId);
    try {
      if (bookmarkedCases.has(caseId)) {
        await unbookmarkCase(caseId);
        setBookmarkedCases(prev => {
          const newSet = new Set(prev);
          newSet.delete(caseId);
          return newSet;
        });
      } else {
        await bookmarkCase(caseId);
        setBookmarkedCases(prev => new Set(prev).add(caseId));
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
    } finally {
      setBookmarkLoading(null);
    }
  };

  // 处理排序变化
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sortMap: Record<string, string> = {
      '相关性': 'createdAt',
      '最新': 'createdAt',
      '评分': 'views',
    };
    setSortOrder(sortMap[e.target.value] || 'createdAt');
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 打开资源详情
  const openResourceDetail = (resourceId: string) => {
    navigate(`/resources/${resourceId}`);
  };

  // 处理资源卡片点击
  const handleResourceClick = (resourceId: string) => {
    openResourceDetail(resourceId);
  };

  // 处理案例卡片点击
  const handleCaseClick = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  // 处理资源按钮点击 (Notebook / Demo / Homework)
  const handleResourceAction = (resource: { id: string; type: string; url?: string }) => {
    if (resource.url) {
      window.open(resource.url, '_blank');
    } else {
      openResourceDetail(resource.id);
    }
  };

  // 处理 "立即探索" 滚动
  const handleScrollToResources = () => {
    resourceGridRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 处理 "加载更多"
  const handleLoadMore = () => {
    const typeMap: Record<string, string> = {
      'all': '',
      'video': 'VIDEO',
      'demo': 'DEMONSTRATION',
      'notebook': 'NOTEBOOK',
      'case': 'CASE',
      'homework': 'HOMEWORK',
    };

    loadMoreResources({
      type: typeMap[activeType] || undefined,
      category: selectedKnowledgePoints.length > 0 ? selectedKnowledgePoints[0] : undefined,
      tag: activeTag !== '不限' ? activeTag : undefined,
      search: searchQuery || undefined,
      sort: sortOrder,
      order: 'desc',
      limit: 12,
    });
  };

  // 侧边栏 "我的收藏" 切换
  const handleBookmarkFilter = () => {
    if (sidebarFilter === 'bookmarks') {
      setSidebarFilter('all');
    } else {
      setSidebarFilter('bookmarks');
      toast.info('显示已收藏的资源');
    }
  };

  // 侧边栏 "最近浏览" 切换
  const handleRecentFilter = () => {
    if (sidebarFilter === 'recent') {
      setSidebarFilter('all');
    } else {
      setSidebarFilter('recent');
      toast.info('显示最近浏览的资源');
    }
  };

  const categories = [
    { id: 'all', name: '全部资源', icon: LayoutGrid },
    { id: 'video', name: '基础知识微课', icon: Play },
    { id: 'demo', name: '算法演示', icon: Code },
    { id: 'notebook', name: 'Jupyter Notebook', icon: FileText },
    { id: 'case', name: '思政案例库', icon: BookOpen },
    { id: 'homework', name: '作业资源', icon: GraduationCap },
  ];

  const resourceTypes = [
    { id: 'all', name: '全部' },
    { id: 'video', name: '基础知识微课' },
    { id: 'demo', name: '算法演示' },
    { id: 'notebook', name: 'Jupyter Notebook' },
    { id: 'case', name: '思政案例' },
    { id: 'homework', name: '作业资源' },
  ];

  const knowledgePoints = [
    { id: 'classification', name: '分类算法' },
    { id: 'clustering', name: '聚类分析' },
    { id: 'association', name: '关联规则' },
    { id: 'preprocessing', name: '数据预处理' },
  ];

  const themes = [
    { id: 'privacy', name: '隐私与伦理' },
    { id: 'culture', name: '文化自信' },
    { id: 'science', name: '科学精神' },
    { id: 'security', name: '国家安全' },
  ];

  const tags = [
    { id: 'all', name: '不限', hot: false },
    { id: 'preview', name: '预习必备', hot: false },
    { id: 'review', name: '期末复习', hot: false },
    { id: 'hard', name: '高难度', hot: false },
    { id: 'easy', name: '入门简单', hot: false },
    { id: 'hot', name: '热门推荐', hot: true },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return <Play className="w-4 h-4" />;
      case 'DEMONSTRATION':
        return <Code className="w-4 h-4" />;
      case 'NOTEBOOK':
        return <FileText className="w-4 h-4" />;
      case 'CASE':
        return <BookOpen className="w-4 h-4" />;
      case 'HOMEWORK':
        return <GraduationCap className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return 'bg-blue-100 text-blue-700';
      case 'DEMONSTRATION':
        return 'bg-purple-100 text-purple-700';
      case 'NOTEBOOK':
        return 'bg-orange-100 text-orange-700';
      case 'CASE':
        return 'bg-green-100 text-green-700';
      case 'HOMEWORK':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return '微课';
      case 'DEMONSTRATION':
        return '演示';
      case 'NOTEBOOK':
        return '实验';
      case 'CASE':
        return '案例';
      case 'HOMEWORK':
        return '作业';
      default:
        return '资源';
    }
  };

  const getTypeImageId = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return '1516321318423-f06f85e504b3';
      case 'DEMONSTRATION':
        return '1635070041078-e363dbe005cb';
      case 'NOTEBOOK':
        return '1555949963-aa79dcee981c';
      case 'HOMEWORK':
        return '1434030216411-0b793f4b4173';
      default:
        return '1460925895917-afdab827c52f';
    }
  };

  const getTagColor = (tag: string) => {
    if (tag === '预习必备') return 'bg-blue-100 text-blue-700';
    if (tag === '复盘重点') return 'bg-purple-100 text-purple-700';
    if (tag === '高难度') return 'bg-red-100 text-red-700';
    if (tag === '典型案例') return 'bg-green-100 text-green-700';
    if (tag === '拓展知识') return 'bg-cyan-100 text-cyan-700';
    if (tag === '作业讲评') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '关联规则':
        return 'bg-blue-100 text-blue-700';
      case '决策树':
        return 'bg-green-100 text-green-700';
      case '聚类':
        return 'bg-purple-100 text-purple-700';
      case '协同过滤':
        return 'bg-orange-100 text-orange-700';
      case '回归分析':
        return 'bg-pink-100 text-pink-700';
      case '文本挖掘':
        return 'bg-cyan-100 text-cyan-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getThemeColor = (theme: string) => {
    if (theme === '文化自信' || theme === '传承') return 'bg-blue-50 text-blue-600';
    if (theme === '伦理' || theme === '社会正义') return 'bg-purple-50 text-purple-600';
    if (theme === '国家安全' || theme === '网络安全') return 'bg-green-50 text-green-600';
    if (theme === '消费者权益' || theme === '商业伦理') return 'bg-orange-50 text-orange-600';
    if (theme === '公共卫生' || theme === '可持续发展') return 'bg-cyan-50 text-cyan-600';
    if (theme === '社会责任' || theme === '公共服务') return 'bg-pink-50 text-pink-600';
    return 'bg-gray-50 text-gray-600';
  };

  // Filter resources based on sidebar filter
  const filteredResources = useMemo(() => {
    if (sidebarFilter === 'bookmarks') {
      return resources.filter((r) => bookmarkedResources.has(r.id));
    }
    return resources;
  }, [resources, sidebarFilter, bookmarkedResources]);

  // 计算分页信息
  const totalResources = resourcesPagination?.total || resources.length;
  const displayedResources = filteredResources.length;
  const totalPages = resourcesPagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">课程资源中心</h1>
          <p className="text-slate-500 mt-1 text-sm">
            融合现代技术与思政教育，提供 150+ 个精选教学案例与学习资源。
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="w-4 h-4" />
            上传资源
          </Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20" onClick={() => navigate('/cases?ai=true')}>
            <Sparkles className="w-4 h-4" />
            AI 生成案例
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 左侧边栏 */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-6">
          {/* 资源分类 */}
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider px-3 mb-3">资源分类导航</h3>
            <div className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                    activeCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : cat.id === 'case'
                        ? 'text-slate-500 hover:bg-purple-50 hover:text-purple-600'
                        : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <cat.icon className={`w-5 h-5 transition-colors ${activeCategory === cat.id ? '' : cat.id === 'case' ? 'group-hover:text-purple-500' : 'group-hover:text-blue-600'}`} />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-200 w-full" />

          {/* 知识点筛选 */}
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider px-3 mb-3">知识点</h3>
            <div className="space-y-2 px-3">
              {knowledgePoints.map((point) => (
                <label
                  key={point.id}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedKnowledgePoints.includes(point.name)}
                    onChange={() => handleKnowledgePointChange(point.name)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">{point.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 思政主题 */}
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider px-3 mb-3">思政主题</h3>
            <div className="space-y-2 px-3">
              {themes.map((theme) => (
                <label
                  key={theme.id}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedThemes.includes(theme.name)}
                    onChange={() => handleThemeChange(theme.name)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">{theme.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-200 w-full" />

          {/* 学习状态 */}
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider px-3 mb-3">学习状态</h3>
            <div className="space-y-1">
              <button
                onClick={() => navigate('/student/analytics')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
              >
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-gray-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path className="text-blue-600" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="75, 100" strokeWidth="4" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-slate-900 text-sm font-medium">学习进度</p>
                  <p className="text-xs text-slate-500">查看详细分析</p>
                </div>
              </button>
              <button
                onClick={handleBookmarkFilter}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  sidebarFilter === 'bookmarks'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-500 hover:bg-green-50 hover:text-green-600'
                }`}
              >
                <Bookmark className={`w-5 h-5 transition-colors ${sidebarFilter === 'bookmarks' ? 'text-white' : 'group-hover:text-green-500'}`} />
                我的收藏
              </button>
              <button
                onClick={handleRecentFilter}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  sidebarFilter === 'recent'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-500 hover:bg-yellow-50 hover:text-yellow-600'
                }`}
              >
                <Clock className={`w-5 h-5 transition-colors ${sidebarFilter === 'recent' ? 'text-white' : 'group-hover:text-yellow-500'}`} />
                最近浏览
              </button>
            </div>
          </div>

          {/* 今日挑战 */}
          <div className="mt-auto">
            <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-200/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="font-bold text-blue-800 text-sm">今日挑战</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  完成"K-Means"实验可获得 +50 积分奖励。
                </p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-bold shadow-sm" size="sm">
                  去完成
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col gap-10">
          {/* 特色横幅 */}
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm group">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600 via-slate-50 to-white" />
            <div className="relative flex flex-col lg:flex-row gap-6 p-6 lg:p-10 items-center">
              <div className="flex-1 flex flex-col gap-4 text-left z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-600/20 w-fit">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                  </span>
                  <span className="text-blue-600 text-xs font-bold uppercase tracking-wider">特色实战专区</span>
                </div>
                <h2 className="text-slate-900 text-3xl lg:text-4xl font-black leading-tight tracking-tight">
                  区域特色数据挖掘案例库
                </h2>
                <p className="text-slate-500 text-base lg:text-lg max-w-xl">
                  结合本地化真实数据集（交通、零售、医疗），提供具有区域特色的数据挖掘实战案例，助力深度学习与应用。
                </p>
                <div className="flex flex-wrap gap-4 mt-2">
                  <Button onClick={handleScrollToResources} className="bg-blue-600 hover:bg-blue-700 gap-2 px-6 py-3 h-auto font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30">
                    立即探索
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={handleScrollToResources} className="px-6 py-3 h-auto font-medium border-slate-200 hover:bg-gray-50 shadow-sm">
                    查看案例列表
                  </Button>
                </div>
              </div>
              <div className="w-full lg:w-1/2 relative">
                <div className="aspect-video w-full rounded-xl overflow-hidden shadow-2xl border border-gray-100 relative bg-gray-50">
                  <img
                    src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop"
                    alt="Data Mining"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex gap-3">
                    <div className="flex-1 bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-white/50 shadow-sm">
                      <p className="text-xs text-slate-500 mb-1">数据集</p>
                      <p className="text-slate-900 font-bold text-sm">24个</p>
                    </div>
                    <div className="flex-1 bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-white/50 shadow-sm">
                      <p className="text-xs text-slate-500 mb-1">实战项目</p>
                      <p className="text-slate-900 font-bold text-sm">12个</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 资源检索 */}
          <div className="flex flex-col gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h3 className="text-slate-900 text-xl font-bold">资源检索</h3>
                <p className="text-sm text-slate-500 mt-1">支持关键词、标签、知识点及思政主题组合筛选</p>
              </div>
              <div className="flex w-full lg:w-2/5 gap-2">
                <div className="flex flex-1 items-center bg-gray-50 rounded-lg px-3 py-2.5 border border-slate-200 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 focus-within:bg-white transition-all">
                  <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="搜索知识点、算法或案例..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="bg-transparent border-none text-slate-900 text-sm focus:ring-0 w-full placeholder:text-slate-400 p-0 leading-normal focus:outline-none"
                  />
                </div>
                <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 px-5 shadow-md shadow-blue-600/20 whitespace-nowrap">
                  搜索
                </Button>
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            {/* 类型筛选 */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <span className="text-slate-900 text-sm font-bold w-12 pt-1 sm:pt-0">类型:</span>
                <div className="flex flex-wrap gap-2">
                  {resourceTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeChange(type.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        activeType === type.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-slate-500 hover:bg-gray-50 hover:text-blue-600 border border-slate-200'
                      }`}
                    >
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 标签筛选 */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <span className="text-slate-900 text-sm font-bold w-12 pt-1 sm:pt-0">标签:</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleTagChange(tag.name)}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        activeTag === tag.name
                          ? 'bg-blue-600 text-white shadow-sm'
                          : tag.hot
                          ? 'text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1'
                          : 'text-slate-500 hover:text-blue-600 hover:bg-gray-100'
                      }`}
                    >
                      {tag.hot && activeTag !== tag.name && <Flame className="w-3.5 h-3.5 fill-current" />}
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 结果统计 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载中...
                </span>
              ) : (
                <>
                  显示 <span className="font-semibold text-slate-900">{totalResources}</span> 个资源中的{' '}
                  <span className="font-semibold text-slate-900">{displayedResources}</span> 个
                </>
              )}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">排序:</span>
                <select 
                  className="text-sm border border-slate-200 rounded-lg bg-white px-3 py-1.5 text-slate-700 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
                  onChange={handleSortChange}
                >
                  <option>相关性</option>
                  <option>最新</option>
                  <option>评分</option>
                </select>
              </div>
            </div>
          </div>

          {/* 资源网格 */}
          <div ref={resourceGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredResources.map((resource) => (
              <div
                key={resource.id}
                className="group flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400/40 hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => handleResourceClick(resource.id)}
              >
                {/* 缩略图 */}
                <div className="relative aspect-video w-full overflow-hidden">
                  <img
                    src={`https://images.unsplash.com/photo-${getTypeImageId(resource.type)}?w=300&h=200&fit=crop`}
                    alt={resource.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                  <div className={`absolute top-3 left-3 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide flex items-center gap-1 shadow-sm ${
                    resource.type === 'VIDEO' ? 'bg-blue-500/90' :
                    resource.type === 'DEMONSTRATION' ? 'bg-purple-500/90' :
                    resource.type === 'NOTEBOOK' ? 'bg-orange-500/90' :
                    resource.type === 'CASE' ? 'bg-green-500/90' :
                    resource.type === 'HOMEWORK' ? 'bg-yellow-500/90' :
                    'bg-gray-500/90'
                  }`}>
                    {getTypeIcon(resource.type)}
                    {getTypeLabel(resource.type)}
                  </div>
                  {resource.duration && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded font-mono backdrop-blur-sm">
                      {resource.duration}
                    </div>
                  )}
                  {/* Play button overlay for videos */}
                  {resource.type === 'VIDEO' && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-blue-600 text-white rounded-full p-2 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-6 h-6 fill-current" />
                      </div>
                    </div>
                  )}
                  {/* 收藏按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResourceBookmark(resource.id);
                    }}
                    disabled={bookmarkLoading === resource.id}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 hover:bg-white transition-colors shadow-sm"
                  >
                    {bookmarkLoading === resource.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : bookmarkedResources.has(resource.id) ? (
                      <BookmarkCheck className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Bookmark className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                    )}
                  </button>
                </div>

                {/* 内容 */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                      resource.tags[0] === '预习必备' ? 'text-blue-600 bg-blue-50 border-blue-600/10' :
                      resource.tags[0] === '复盘重点' ? 'text-purple-600 bg-purple-50 border-purple-100' :
                      resource.tags[0] === '高难度' ? 'text-orange-600 bg-orange-50 border-orange-100' :
                      resource.tags[0] === '典型案例' ? 'text-green-600 bg-green-50 border-green-100' :
                      resource.tags[0] === '拓展知识' ? 'text-slate-500 bg-gray-100 border-slate-200' :
                      resource.tags[0] === '作业讲评' ? 'text-yellow-600 bg-yellow-50 border-yellow-100' :
                      'text-slate-500 bg-gray-100 border-slate-200'
                    }`}>
                      {resource.tags[0]}
                    </span>
                    <span className="text-xs text-yellow-600 font-medium flex items-center gap-0.5">+{resource.points} 积分</span>
                  </div>
                  <h4 className="text-slate-900 text-base font-bold mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {resource.title}
                  </h4>
                  <p className="text-slate-500 text-xs line-clamp-2 mb-4">
                    {resource.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
                    {resource.type === 'NOTEBOOK' ? (
                      <button onClick={(e) => { e.stopPropagation(); handleResourceAction(resource); }} className="text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded w-full transition-colors shadow-sm">
                        打开 Jupyter Notebook
                      </button>
                    ) : resource.type === 'DEMONSTRATION' ? (
                      <button onClick={(e) => { e.stopPropagation(); handleResourceAction(resource); }} className="text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded w-full transition-colors shadow-sm">
                        开始演示
                      </button>
                    ) : resource.type === 'HOMEWORK' ? (
                      <button onClick={(e) => { e.stopPropagation(); handleResourceAction(resource); }} className="text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-700 px-3 py-1.5 rounded w-full transition-colors shadow-sm">
                        查看作业资源
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-500">{resource.views}</span>
                        </div>
                        <span className="text-xs text-slate-500">{resource.author}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {(() => {
                // Calculate page range around current page
                const maxVisible = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                
                // Adjust start if we're near the end
                if (endPage - startPage + 1 < maxVisible) {
                  startPage = Math.max(1, endPage - maxVisible + 1);
                }
                
                const pages = [];
                
                // Show first page if not in range
                if (startPage > 1) {
                  pages.push(
                    <button
                      key={1}
                      onClick={() => handlePageChange(1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg font-medium border border-slate-200 text-slate-700 hover:bg-gray-50 transition-colors"
                    >
                      1
                    </button>
                  );
                  if (startPage > 2) {
                    pages.push(<span key="ellipsis-start" className="text-slate-400 px-1">...</span>);
                  }
                }
                
                // Show page range
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg font-medium transition-colors ${
                        currentPage === i
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'border border-slate-200 text-slate-700 hover:bg-gray-50'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
                
                // Show last page if not in range
                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pages.push(<span key="ellipsis-end" className="text-slate-400 px-1">...</span>);
                  }
                  pages.push(
                    <button
                      key={totalPages}
                      onClick={() => handlePageChange(totalPages)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg font-medium transition-colors ${
                        currentPage === totalPages
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'border border-slate-200 text-slate-700 hover:bg-gray-50'
                      }`}
                    >
                      {totalPages}
                    </button>
                  );
                }
                
                return pages;
              })()}
              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 思政案例区域 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">精选思政案例</h3>
              <Button variant="link" className="text-blue-600 font-medium">
                查看全部
              </Button>
            </div>
          </div>

          {/* 案例网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="group flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-blue-400/40 hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => handleCaseClick(caseItem.id)}
              >
                <div className="p-5 flex flex-col flex-1">
                  {/* 头部 */}
                  <div className="flex items-start justify-between mb-3">
                    <Badge className={`${getCategoryColor(caseItem.category)} border-0`}>
                      {caseItem.category}
                    </Badge>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCaseBookmark(caseItem.id);
                      }}
                      disabled={bookmarkLoading === caseItem.id}
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      {bookmarkLoading === caseItem.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : bookmarkedCases.has(caseItem.id) ? (
                        <BookmarkCheck className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Bookmark className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* 标题 */}
                  <h4 className="font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {caseItem.title}
                  </h4>

                  {/* 描述 */}
                  <p className="text-sm text-slate-500 line-clamp-3 mb-4">
                    {caseItem.description}
                  </p>

                  {/* 主题标签 */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {caseItem.theme.map((theme) => (
                      <span
                        key={theme}
                        className={`px-2 py-1 rounded text-xs font-medium ${getThemeColor(theme)}`}
                      >
                        #{theme}
                      </span>
                    ))}
                  </div>

                  {/* 底部信息 */}
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {(caseItem.views / 1000).toFixed(1)}k
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        {caseItem.rating}
                      </span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleCaseClick(caseItem.id); }} className="text-blue-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      查看详情
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 加载更多 */}
          {resourcesPagination && resourcesPagination.page < resourcesPagination.totalPages && (
            <div className="flex justify-center pb-10">
              <button
                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:bg-gray-50 text-slate-500 hover:text-slate-900 rounded-lg transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                加载更多资源
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 上传资源对话框 */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>上传资源</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">资源标题</label>
              <Input
                placeholder="例如：Python 数据分析入门教程"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">资源描述</label>
              <Textarea
                placeholder="详细描述资源内容..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">资源类型</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="NOTEBOOK">Notebook</option>
                <option value="VIDEO">视频</option>
                <option value="DEMONSTRATION">演示</option>
                <option value="CASE">案例</option>
                <option value="HOMEWORK">作业</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">上传文件</label>
              <Input
                type="file"
                accept=".pdf,.ipynb"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-500">支持 PDF 和 Jupyter Notebook (.ipynb) 文件，最大 10MB</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">标签</label>
              <Input
                placeholder="用逗号分隔，例如：Python, 数据分析, 入门"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">分类</label>
              <Input
                placeholder="例如：数据预处理"
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleUploadResource}
                disabled={isUploading || !uploadTitle.trim() || !uploadDescription.trim()}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                上传
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
