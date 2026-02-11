import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { useCaseStore } from '@/stores/caseStore';
import { useResourceStore } from '@/stores/resourceStore';
import { NotebookPreview } from '@/components/NotebookPreview';
import { ArrowLeft, Bookmark, BookmarkCheck, Eye, Loader2, MessageCircle, Send, ExternalLink } from 'lucide-react';
import type { Case, Comment, Resource } from '@/types';

function PDFPreview({ url }: { url: string }) {
  return <iframe src={url} className="h-[520px] w-full rounded-md border" title="PDF Preview" />;
}

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const caseStore = useCaseStore();
  const resourceStore = useResourceStore();

  const detailMode = useMemo<'case' | 'resource'>(() => {
    if (location.pathname.includes('/resources/')) return 'resource';
    return 'case';
  }, [location.pathname]);

  const [mode, setMode] = useState<DetailMode>(null);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [resourceData, setResourceData] = useState<Resource | null>(null);
  const [resourcePreview, setResourcePreview] = useState<{ type: string; url?: string; content?: any } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setCaseData(null);
    setResourceData(null);
    setResourcePreview(null);

    try {
      if (detailMode === 'case') {
        const data = await caseStore.fetchCaseDetail(id);
        setCaseData(data);
      } else {
        const data = await resourceStore.fetchResourceDetail(id);
        setResourceData(data);
        if (data.filePath) {
          const preview = await resourceStore.previewResourceFile(id);
          setResourcePreview(preview);
        }
      }
    } catch (error) {
      toast.error(detailMode === 'case' ? '获取案例详情失败' : '获取资源详情失败');
    } finally {
      setLoading(false);
    }
  }, [id, detailMode, caseStore, resourceStore]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    try {
      const list = detailMode === 'case' ? await caseStore.fetchComments(id) : await resourceStore.fetchComments(id);
      setComments(list as Comment[]);
    } catch {
      setComments([]);
    }
  }, [id, detailMode, caseStore, resourceStore]);

  useEffect(() => {
    if (!id) return;
    if (detailMode === 'resource') {
      resourceStore.recordView(id);
    }
    loadDetail();
    loadComments();
  }, [id, detailMode, loadDetail, loadComments, resourceStore]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    const run = async () => {
      const status = detailMode === 'case' ? await caseStore.checkBookmark(id) : await resourceStore.checkBookmark(id);
      setIsBookmarked(status);
    };
    run();
  }, [id, detailMode, isAuthenticated, caseStore, resourceStore]);

  const handleBookmark = async () => {
    if (!id || !isAuthenticated) {
      toast.error('请先登录');
      return;
    }
    setBookmarkLoading(true);
    try {
      if (detailMode === 'case') {
        if (isBookmarked) await caseStore.unbookmarkCase(id);
        else await caseStore.bookmarkCase(id);
      } else if (isBookmarked) {
        await resourceStore.unbookmarkResource(id);
      } else {
        await resourceStore.bookmarkResource(id);
      }
      setIsBookmarked((v) => !v);
      toast.success(isBookmarked ? '已取消收藏' : '收藏成功');
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!id || !commentText.trim()) return;
    if (!isAuthenticated) {
      toast.error('请先登录后再评论');
      return;
    }

    setCommentLoading(true);
    try {
      const content = commentText.trim();
      const newComment = detailMode === 'case' ? await caseStore.addComment(id, content) : await resourceStore.addComment(id, content);
      setComments((prev) => [newComment as Comment, ...prev]);
      setCommentText('');
      toast.success('评论已发布');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return;
    try {
      if (detailMode === 'case') await caseStore.deleteComment(id, commentId);
      else await resourceStore.deleteComment(id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success('评论已删除');
    } catch {
      toast.error('删除评论失败');
    }
  };

  const title = detailMode === 'case' ? caseData?.title : resourceData?.title;
  const description = detailMode === 'case' ? caseData?.description : resourceData?.description;
  const tags = detailMode === 'case' ? caseData?.tags || [] : resourceData?.tags || [];

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!title) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />返回</Button>
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">未找到详情数据，可能 ID 类型不匹配或数据不存在。</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />返回</Button>
        <Button variant="outline" className="gap-2" onClick={handleBookmark} disabled={bookmarkLoading}>
          {bookmarkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {isBookmarked ? '已收藏' : '收藏'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <Badge variant="secondary">{detailMode === 'case' ? '案例详情' : '资源详情'}</Badge>
            {detailMode === 'resource' && resourceData?.type && <Badge variant="outline">{resourceData.type}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {detailMode === 'case' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3 text-sm">分类：{caseData?.category || '-'}</div>
                <div className="rounded-md bg-slate-50 p-3 text-sm">难度：{caseData?.difficulty || '-'}</div>
                <div className="rounded-md bg-slate-50 p-3 text-sm">浏览：{caseData?.views ?? 0}</div>
              </div>
              {caseData?.content && <div className="whitespace-pre-wrap rounded-md border p-4 text-sm leading-6">{caseData.content}</div>}
              {caseData?.codeExample && <pre className="overflow-auto rounded-md bg-[#1e1e1e] p-4 text-xs text-slate-100">{caseData.codeExample}</pre>}
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3 text-sm">分类：{resourceData?.category || '-'}</div>
                <div className="rounded-md bg-slate-50 p-3 text-sm">积分：{resourceData?.points ?? 0}</div>
                <div className="rounded-md bg-slate-50 p-3 text-sm">浏览：{resourceData?.views ?? 0}</div>
              </div>
              {resourceData?.url && (
                <a href={resourceData.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <ExternalLink className="h-4 w-4" />打开外部资源
                </a>
              )}
              {resourcePreview?.type === 'pdf' && resourcePreview.url && <PDFPreview url={resourcePreview.url} />}
              {resourcePreview?.type === 'ipynb' && resourcePreview.content && (
                <NotebookPreview content={resourcePreview.content} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />评论区（{comments.length}）</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="写下你的想法..." rows={3} />
            <Button onClick={handleSubmitComment} disabled={commentLoading || !commentText.trim()} className="gap-2">
              {commentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}发表评论
            </Button>
          </div>
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{comment.username}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteComment(comment.id)}>删除</Button>
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sm text-muted-foreground">暂无评论</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
