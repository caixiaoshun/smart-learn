import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { useChatStore } from '@/stores/chatStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Search,
  Upload,
  Sparkles,
  Bookmark,
  Eye,
  Star,
  ChevronRight,
  LayoutGrid,
  List,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

const CATEGORY_OPTIONS = ['关联规则', '决策树', '聚类', '协同过滤', '回归分析', '文本挖掘'];
const THEME_PRESETS = ['文化自信', '伦理', '国家安全', '消费者权益', '公共卫生', '社会责任', '科学精神', '传承'];
const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: '简单' },
  { value: 'MEDIUM', label: '中等' },
  { value: 'HARD', label: '困难' },
];

type ViewMode = 'grid' | 'list';
type SortOption = 'relevance' | 'newest' | 'rating';

export function CaseLibraryPage() {
  const { cases, pagination, fetchCases, createCase, bookmarkCase, unbookmarkCase, fetchMyBookmarkIds } = useCaseStore();
  const { selectedModel, fetchModels } = useChatStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Upload Case Dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    content: '',
    category: CATEGORY_OPTIONS[0],
    theme: [] as string[],
    tags: '',
    difficulty: 'MEDIUM' as string,
    duration: 2,
    codeExample: '',
  });

  // AI Generate Case Dialog state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{
    title: string;
    description: string;
    content: string;
    category: string;
    theme: string[];
    tags: string[];
    difficulty: string;
    codeExample: string;
  } | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    fetchCases();
    fetchModels();
    fetchMyBookmarkIds().then((ids) => setBookmarkedIds(new Set(ids)));
  }, []);

  // Open AI dialog when navigated with ?ai=true
  useEffect(() => {
    if (searchParams.get('ai') === 'true') {
      setAiOpen(true);
    }
  }, [searchParams]);

  // Derive unique knowledge points (categories) from the loaded cases
  const knowledgePoints = useMemo(() => {
    const categories = new Set(cases.map((c) => c.category));
    return Array.from(categories).map((name) => ({
      id: name,
      name,
    }));
  }, [cases]);

  // Derive unique themes from the loaded cases
  const themeOptions = useMemo(() => {
    const themes = new Set(cases.flatMap((c) => c.theme));
    return Array.from(themes).map((name) => ({
      id: name,
      name,
    }));
  }, [cases]);

  // Filter and sort cases based on current state
  const filteredCases = useMemo(() => {
    let result = cases;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (selectedCategories.size > 0) {
      result = result.filter((c) => selectedCategories.has(c.category));
    }

    // Theme filter
    if (selectedThemes.size > 0) {
      result = result.filter((c) => c.theme.some((t) => selectedThemes.has(t)));
    }

    // Sort
    if (sortBy === 'newest') {
      // Reverse the original order (backend returns cases in creation order)
      result = [...result].reverse();
    } else if (sortBy === 'rating') {
      result = [...result].sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [cases, searchQuery, selectedCategories, selectedThemes, sortBy]);

  // Pagination
  const pageSize = pagination?.limit ?? 12;
  const totalFiltered = filteredCases.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategories, selectedThemes, sortBy]);

  const toggleCategory = useCallback((name: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleTheme = useCallback((name: string) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Compute visible page numbers with truncation for large page counts
  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push('ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPage]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategories(new Set());
    setSelectedThemes(new Set());
    setSortBy('relevance');
    setCurrentPage(1);
  }, []);

  const handleToggleBookmark = useCallback(async (caseId: string) => {
    const isBookmarked = bookmarkedIds.has(caseId);
    try {
      if (isBookmarked) {
        await unbookmarkCase(caseId);
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          next.delete(caseId);
          return next;
        });
        toast.success('已取消收藏');
      } else {
        await bookmarkCase(caseId);
        setBookmarkedIds((prev) => new Set(prev).add(caseId));
        toast.success('已收藏');
      }
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    }
  }, [bookmarkedIds, bookmarkCase, unbookmarkCase]);

  // Upload Case handlers
  const handleUploadSubmit = async () => {
    if (!uploadForm.title.trim() || !uploadForm.description.trim()) {
      toast.error('请填写标题和描述');
      return;
    }
    if (uploadForm.theme.length === 0) {
      toast.error('请至少选择一个思政主题');
      return;
    }
    setUploadSubmitting(true);
    try {
      await createCase({
        title: uploadForm.title.trim(),
        description: uploadForm.description.trim(),
        content: uploadForm.content.trim() || undefined,
        category: uploadForm.category,
        theme: uploadForm.theme,
        tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        difficulty: uploadForm.difficulty,
        duration: uploadForm.duration,
        codeExample: uploadForm.codeExample.trim() || undefined,
      });
      toast.success('案例创建成功');
      setUploadOpen(false);
      setUploadForm({
        title: '', description: '', content: '', category: CATEGORY_OPTIONS[0],
        theme: [], tags: '', difficulty: 'MEDIUM', duration: 2, codeExample: '',
      });
    } catch (err: any) {
      toast.error(err.message || '创建案例失败');
    } finally {
      setUploadSubmitting(false);
    }
  };

  const toggleUploadTheme = (theme: string) => {
    setUploadForm(prev => ({
      ...prev,
      theme: prev.theme.includes(theme)
        ? prev.theme.filter(t => t !== theme)
        : [...prev.theme, theme],
    }));
  };

  // AI Generate Case handlers
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('请输入案例主题描述');
      return;
    }
    if (!selectedModel) {
      toast.error('AI 模型未就绪，请稍后再试');
      return;
    }
    setAiGenerating(true);
    setAiResult(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/ai/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: 'user' as const,
                content: `请根据以下主题生成一个数据挖掘课程思政教学案例，并严格按照 JSON 格式返回（不要包含任何其他文字，只返回 JSON）。

主题描述：${aiPrompt.trim()}

请返回如下格式的 JSON：
{
  "title": "案例标题",
  "description": "案例简要描述（50-100字）",
  "content": "案例详细内容（200-500字）",
  "category": "知识点分类（从以下选择：关联规则、决策树、聚类、协同过滤、回归分析、文本挖掘）",
  "theme": ["思政主题1", "思政主题2"],
  "tags": ["标签1", "标签2", "标签3"],
  "difficulty": "MEDIUM",
  "codeExample": "相关的 Python 代码示例（可选）"
}`,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error('AI 生成失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) fullContent += parsed.content;
          } catch {
            // skip malformed
          }
        }
      }

      // Extract JSON from the AI response
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 返回格式异常，请重试');
      }
      const generated = JSON.parse(jsonMatch[0]);
      setAiResult({
        title: generated.title || '',
        description: generated.description || '',
        content: generated.content || '',
        category: CATEGORY_OPTIONS.includes(generated.category) ? generated.category : CATEGORY_OPTIONS[0],
        theme: Array.isArray(generated.theme) ? generated.theme : [],
        tags: Array.isArray(generated.tags) ? generated.tags : [],
        difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(generated.difficulty) ? generated.difficulty : 'MEDIUM',
        codeExample: generated.codeExample || '',
      });
      toast.success('AI 案例生成完成，请审核后保存');
    } catch (err: any) {
      toast.error(err.message || 'AI 生成失败');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiSave = async () => {
    if (!aiResult) return;
    setAiSaving(true);
    try {
      await createCase({
        title: aiResult.title,
        description: aiResult.description,
        content: aiResult.content,
        category: aiResult.category,
        theme: aiResult.theme.length > 0 ? aiResult.theme : [THEME_PRESETS[0]],
        tags: aiResult.tags,
        difficulty: aiResult.difficulty,
        codeExample: aiResult.codeExample || undefined,
      });
      toast.success('AI 案例保存成功');
      setAiOpen(false);
      setAiPrompt('');
      setAiResult(null);
    } catch (err: any) {
      toast.error(err.message || '保存案例失败');
    } finally {
      setAiSaving(false);
    }
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

  return (
    <div className="space-y-6">
      {/* 面包屑 */}
      <div className="flex flex-wrap items-center gap-2 text-sm bg-white/50 backdrop-blur-sm p-3 rounded-lg border border-blue-100/30">
        <span className="text-slate-500 hover:text-blue-600 cursor-pointer">首页</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-500 hover:text-blue-600 cursor-pointer">课程</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-500 hover:text-blue-600 cursor-pointer">数据挖掘导论</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-blue-600 font-semibold">案例库</span>
      </div>

      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-blue-100/60">
        <div className="flex flex-col gap-3 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-tight text-slate-800">
            《数据挖掘导论》课程思政案例库
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed">
            融合现代技术与思政教育，提供 <span className="font-semibold text-slate-800">{(pagination?.total ?? cases.length) || 0}+</span> 个精选教学案例。覆盖分类、聚类、关联规则等核心算法，支持
            <span className="text-blue-600 font-semibold">"案例资源 — 行为数据 — 积分评价"</span>
            一体化教学。
          </p>
        </div>
        <div className="flex items-start gap-3 flex-shrink-0">
          <Button variant="outline" className="gap-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-300 shadow-sm" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4" />
            上传案例
          </Button>
          <Button className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg hover:shadow-blue-500/30 transition-all" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4" />
            AI 生成案例
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500/70" />
        <input
          type="text"
          placeholder="按关键字、算法搜索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-blue-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 shadow-sm transition-all"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 左侧筛选面板 */}
        <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
          <Card className="border-blue-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">筛选</h3>
                <button className="text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors" onClick={resetFilters}>
                  重置所有
                </button>
              </div>

              {/* 知识点 */}
              <div className="mb-6">
                <h4 className="font-semibold text-slate-800 mb-3">知识点</h4>
                <div className="space-y-2 pl-2 border-l-2 border-blue-100 ml-1">
                  {knowledgePoints.map((point) => (
                    <label
                      key={point.id}
                      className="flex items-center gap-3 cursor-pointer group/item hover:bg-blue-50 p-1.5 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(point.name)}
                        onChange={() => toggleCategory(point.name)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm transition-colors ${selectedCategories.has(point.name) ? 'text-slate-900 font-medium' : 'text-slate-600 group-hover/item:text-blue-600'}`}>{point.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 思政主题 */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">思政主题</h4>
                <div className="space-y-2 pl-2 border-l-2 border-blue-100 ml-1">
                  {themeOptions.map((theme) => (
                    <label
                      key={theme.id}
                      className="flex items-center gap-3 cursor-pointer group/item hover:bg-blue-50 p-1.5 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedThemes.has(theme.name)}
                        onChange={() => toggleTheme(theme.name)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm transition-colors ${selectedThemes.has(theme.name) ? 'text-slate-900 font-medium' : 'text-slate-600 group-hover/item:text-blue-600'}`}>{theme.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 数据洞察 */}
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 shadow-lg shadow-blue-200 text-white">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-bold">数据洞察</span>
            </div>
            <p className="text-xs text-blue-50 mb-3 leading-relaxed">
              {knowledgePoints.length > 0
                ? `当前案例库覆盖 ${knowledgePoints.length} 个知识点、${themeOptions.length} 个思政主题。`
                : '暂无案例数据。'}
            </p>
            <button
              className="text-xs font-bold text-white hover:text-blue-100 flex items-center gap-1 group"
              onClick={() => navigate('/student/analytics')}
            >
              查看分析
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 flex flex-col gap-6">
          {/* 结果统计 */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
            <p className="text-sm text-slate-500 pl-2">
              显示 <span className="text-slate-800 font-bold">{totalFiltered}</span> 个结果（共{' '}
              <span className="text-blue-600 font-bold">{cases.length}</span> 个案例）
            </p>
            <div className="flex items-center gap-3">
              <select
                className="text-sm bg-slate-50 border-blue-100 text-slate-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-2 pl-3 pr-10 cursor-pointer hover:bg-white transition-colors"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="relevance">排序：相关性</option>
                <option value="newest">最新添加</option>
                <option value="rating">最多浏览</option>
              </select>
              <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                <button
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-blue-600 hover:bg-white'} transition-all`}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-blue-600 hover:bg-white'} transition-all`}
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 案例列表 */}
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
            {paginatedCases.map((caseItem) => (
              <article
                key={caseItem.id}
                className="group relative flex flex-col bg-white rounded-xl border border-blue-100 overflow-hidden hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1 cursor-pointer"
                onClick={() => navigate(`/cases/${caseItem.id}`)}
              >
                <div className={viewMode === 'list' ? 'p-5 flex gap-5' : 'p-5 flex flex-col gap-4 flex-1'}>
                  {/* 头部 */}
                  <div className={viewMode === 'list' ? 'flex-1' : ''}>
                    <div className="flex items-start justify-between mb-3">
                      <Badge className={`${getCategoryColor(caseItem.category)} border`}>
                        {caseItem.category}
                      </Badge>
                      <button
                        className={`transition-colors ${bookmarkedIds.has(caseItem.id) ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
                        onClick={(e) => { e.stopPropagation(); handleToggleBookmark(caseItem.id); }}
                      >
                        <Bookmark className={`w-5 h-5 ${bookmarkedIds.has(caseItem.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* 标题 */}
                    <h3 className="text-lg font-bold text-slate-800 mb-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {caseItem.title}
                    </h3>

                    {/* 描述 */}
                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-4">
                      {caseItem.description}
                    </p>

                    {/* 主题标签 */}
                    <div className="flex flex-wrap gap-2 mt-auto mb-4">
                      {caseItem.theme.map((theme) => (
                        <span
                          key={theme}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-500 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors"
                        >
                          #{theme}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 底部信息 */}
                <div className="bg-slate-50/50 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4 text-blue-500" />
                      <span>{(caseItem.views / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span>{caseItem.rating}</span>
                    </div>
                  </div>
                  <button
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
                    onClick={(e) => { e.stopPropagation(); navigate(`/cases/${caseItem.id}`); }}
                  >
                    查看详情
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 pb-8">
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm bg-white">
                <button
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-blue-100 hover:bg-slate-50 disabled:opacity-50"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {visiblePages.map((page, idx) =>
                  page === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-inset ring-blue-100">...</span>
                  ) : (
                    <button
                      key={page}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        page === currentPage
                          ? 'z-10 bg-blue-600 text-white focus-visible:outline-blue-600'
                          : 'text-slate-700 ring-1 ring-inset ring-blue-100 hover:bg-slate-50'
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-blue-100 hover:bg-slate-50 disabled:opacity-50"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            </div>
          )}
        </main>
      </div>

      {/* Upload Case Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>上传案例</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>标题 *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="案例标题"
              />
            </div>
            <div>
              <Label>描述 *</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm(f => ({ ...f, description: e.target.value }))}
                placeholder="案例描述（至少10字）"
                rows={3}
              />
            </div>
            <div>
              <Label>详细内容</Label>
              <Textarea
                value={uploadForm.content}
                onChange={(e) => setUploadForm(f => ({ ...f, content: e.target.value }))}
                placeholder="案例详细内容"
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>知识点分类 *</Label>
                <select
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>难度</Label>
                <select
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={uploadForm.difficulty}
                  onChange={(e) => setUploadForm(f => ({ ...f, difficulty: e.target.value }))}
                >
                  {DIFFICULTY_OPTIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>思政主题 *（至少选择一个）</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {THEME_PRESETS.map(theme => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleUploadTheme(theme)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      uploadForm.theme.includes(theme)
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>标签（逗号分隔）</Label>
              <Input
                value={uploadForm.tags}
                onChange={(e) => setUploadForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="如：购物篮分析, Apriori, 零售"
              />
            </div>
            <div>
              <Label>预计学习时长（小时）</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={uploadForm.duration}
                onChange={(e) => setUploadForm(f => ({ ...f, duration: parseInt(e.target.value) || 2 }))}
              />
            </div>
            <div>
              <Label>代码示例（可选）</Label>
              <Textarea
                value={uploadForm.codeExample}
                onChange={(e) => setUploadForm(f => ({ ...f, codeExample: e.target.value }))}
                placeholder="Python 代码示例"
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>取消</Button>
              <Button
                onClick={handleUploadSubmit}
                disabled={uploadSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploadSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                创建案例
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Case Dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              AI 生成案例
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {!aiResult ? (
              <>
                <div>
                  <Label>描述你想生成的案例主题</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="例如：利用关联规则分析超市购物数据，体现消费者权益保护的思政理念"
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setAiOpen(false)}>取消</Button>
                  <Button
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiGenerating ? '生成中...' : '开始生成'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  AI 已生成以下案例，请审核内容后保存。
                </div>
                <div>
                  <Label>标题</Label>
                  <Input
                    value={aiResult.title}
                    onChange={(e) => setAiResult(r => r ? { ...r, title: e.target.value } : r)}
                  />
                </div>
                <div>
                  <Label>描述</Label>
                  <Textarea
                    value={aiResult.description}
                    onChange={(e) => setAiResult(r => r ? { ...r, description: e.target.value } : r)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>详细内容</Label>
                  <Textarea
                    value={aiResult.content}
                    onChange={(e) => setAiResult(r => r ? { ...r, content: e.target.value } : r)}
                    rows={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>知识点分类</Label>
                    <select
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      value={aiResult.category}
                      onChange={(e) => setAiResult(r => r ? { ...r, category: e.target.value } : r)}
                    >
                      {CATEGORY_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>难度</Label>
                    <select
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      value={aiResult.difficulty}
                      onChange={(e) => setAiResult(r => r ? { ...r, difficulty: e.target.value } : r)}
                    >
                      {DIFFICULTY_OPTIONS.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>思政主题</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {aiResult.theme.join(', ') || '无'}
                  </p>
                </div>
                <div>
                  <Label>标签</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {aiResult.tags.join(', ') || '无'}
                  </p>
                </div>
                {aiResult.codeExample && (
                  <div>
                    <Label>代码示例</Label>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto mt-1">
                      {aiResult.codeExample}
                    </pre>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setAiResult(null); }}
                  >
                    重新生成
                  </Button>
                  <Button
                    onClick={handleAiSave}
                    disabled={aiSaving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {aiSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    保存案例
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
