import { useEffect, useState } from 'react';
import { usePeerReviewStore } from '@/stores/peerReviewStore';
import { useHomeworkStore } from '@/stores/homeworkStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileCheck,
  Clock,
  Star,
  Download,
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  FileText,
  Send,
} from 'lucide-react';
import type { PeerReviewTask, PeerReview } from '@/types';

export function PeerReviewPage() {
  const {
    myTasks,
    reviews,
    isLoading,
    fetchMyTasks,
    submitReview,
    fetchReviews,
  } = usePeerReviewStore();

  const { downloadFile } = useHomeworkStore();

  const [selectedTask, setSelectedTask] = useState<PeerReviewTask | null>(null);
  const [reviewScore, setReviewScore] = useState<number[]>([0]);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  // 查看收到评价的 submissionId
  const [viewingSubmissionId, setViewingSubmissionId] = useState<string | null>(null);
  const [viewingMaxScore, setViewingMaxScore] = useState(100);

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const pendingTasks = myTasks.filter(t => t.status === 'PENDING');
  const completedTasks = myTasks.filter(t => t.status === 'COMPLETED');

  const handleSelectTask = (task: PeerReviewTask) => {
    setSelectedTask(task);
    setReviewScore([0]);
    setReviewComment('');
  };

  const handleSubmitReview = async () => {
    if (!selectedTask || reviewScore[0] === 0) return;

    setSubmitting(true);
    try {
      await submitReview(
        selectedTask.homeworkId,
        selectedTask.submissionId,
        reviewScore[0],
        reviewComment || undefined,
      );
      setSelectedTask(null);
      setReviewScore([0]);
      setReviewComment('');
    } catch {
      // handled by global interceptor
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewReceivedReviews = (task: PeerReviewTask) => {
    setViewingSubmissionId(task.submissionId);
    setViewingMaxScore(task.homework.maxScore);
    fetchReviews(task.submissionId);
    setActiveTab('received');
  };

  const maxScore = selectedTask?.homework.maxScore || 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">同行互评中心</h1>
            <p className="text-slate-500 mt-1">完成分配给您的同行互评任务</p>
          </div>
          {pendingTasks.length > 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-sm px-3 py-1">
              进行中
            </Badge>
          )}
        </div>

        {/* Warning Banner */}
        {pendingTasks.length > 0 && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-orange-800">未评提醒</h3>
              <p className="text-sm text-orange-700 mt-1">
                您还有 <strong className="font-bold">{pendingTasks.length}</strong> 个作业待评价。请及时完成评审，逾期可能影响您的最终成绩。
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-slate-200">
          <TabsList className="bg-transparent h-auto p-0 gap-6">
            <TabsTrigger
              value="pending"
              className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-1 pb-3 pt-1 gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              待我评价
              {pendingTasks.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-1 pb-3 pt-1 gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              我的评价
            </TabsTrigger>
            <TabsTrigger
              value="received"
              className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-1 pb-3 pt-1 gap-1.5"
            >
              <Star className="w-4 h-4" />
              收到的评价
            </TabsTrigger>
          </TabsList>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-500 mt-4">加载中...</p>
          </div>
        ) : (
          <>
            {/* 待我评价 Tab */}
            <TabsContent value="pending">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                  <FileCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">暂无待评审任务</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Task List & Viewer */}
                  <div className="lg:col-span-8 space-y-4">
                    {/* Task Selector */}
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {pendingTasks.map((task, idx) => (
                        <button
                          key={task.id}
                          onClick={() => handleSelectTask(task)}
                          className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                            selectedTask?.id === task.id
                              ? 'bg-white border-2 border-blue-600 text-blue-600 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            selectedTask?.id === task.id ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'
                          }`} />
                          匿名作业 #{String(idx + 1).padStart(2, '0')}
                        </button>
                      ))}
                    </div>

                    {/* Document Viewer */}
                    {selectedTask ? (
                      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-100 text-blue-600 p-2 rounded">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{selectedTask.homework.title}</h4>
                              <p className="text-xs text-slate-500">
                                提交时间: {new Date(selectedTask.submission.submittedAt).toLocaleString('zh-CN')}
                              </p>
                            </div>
                          </div>
                          {selectedTask.submission.files.length > 0 && (
                            <button
                              onClick={() => downloadFile(selectedTask.homeworkId, selectedTask.submission.files[0])}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                            >
                              <Download className="w-4 h-4" /> 下载附件
                            </button>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="text-sm text-slate-600">
                              <strong className="text-slate-800">提交文件：</strong>
                              {selectedTask.submission.files.map((file, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs ml-2">
                                  <FileText className="w-3 h-3" />
                                  {file}
                                </span>
                              ))}
                            </div>
                            {selectedTask.submission.laborDivision && (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-sm font-medium text-blue-800 mb-1">分工说明</p>
                                <p className="text-sm text-blue-700 whitespace-pre-wrap">
                                  {typeof selectedTask.submission.laborDivision === 'string'
                                    ? selectedTask.submission.laborDivision
                                    : Array.isArray(selectedTask.submission.laborDivision)
                                      ? selectedTask.submission.laborDivision.map((item: { name?: string; task?: string; ratio?: number }) =>
                                          `${item.name || ''}：${item.task || ''} ${item.ratio ? `(${item.ratio}%)` : ''}`
                                        ).join('\n')
                                      : JSON.stringify(selectedTask.submission.laborDivision, null, 2)}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                        <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">请选择一个待评审的作业</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Evaluation Form */}
                  <div className="lg:col-span-4">
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 sticky top-24">
                      <div className="p-5 border-b border-slate-200 bg-blue-50/50">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <FileCheck className="w-5 h-5 text-blue-600" />
                          评价打分表
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          双向匿名评审：您的身份和作者身份均已隐藏
                        </p>
                      </div>
                      <div className="p-5 space-y-6">
                        {/* Score Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <label className="text-sm font-semibold text-slate-700">评分</label>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                              reviewScore[0] > 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-400 bg-slate-100'
                            }`}>
                              {reviewScore[0]} / {maxScore}
                            </span>
                          </div>
                          <Slider
                            value={reviewScore}
                            onValueChange={setReviewScore}
                            min={0}
                            max={maxScore}
                            step={1}
                            className="py-2"
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>0</span>
                            <span>{maxScore}</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-100" />

                        {/* Comment */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            评语与建议
                          </label>
                          <Textarea
                            placeholder="请给出具体的评价意见和修改建议..."
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            rows={4}
                            maxLength={300}
                            className="resize-none text-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <div className="flex justify-end mt-1">
                            <span className="text-xs text-slate-400">{reviewComment.length} / 300 字</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-between items-center">
                        <div>
                          <span className="block text-xs text-slate-500 uppercase tracking-wider font-semibold">总分</span>
                          <span className="text-2xl font-bold text-slate-900">
                            {reviewScore[0]}
                            <span className="text-sm text-slate-400 font-normal">/{maxScore}</span>
                          </span>
                        </div>
                        <Button
                          className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 gap-2"
                          onClick={handleSubmitReview}
                          disabled={!selectedTask || reviewScore[0] === 0 || submitting}
                        >
                          <Send className="w-4 h-4" />
                          {submitting ? '提交中...' : '提交评价'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 我的评价 Tab */}
            <TabsContent value="completed">
              {completedTasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                  <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">暂无已完成的评审</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <Card key={task.id} className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-green-100 text-green-700 border-green-200">已完成</Badge>
                            <span className="font-medium text-slate-900">{task.homework.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Clock className="w-4 h-4" />
                            <span>截止：{new Date(task.deadline).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 收到的评价 Tab */}
            <TabsContent value="received">
              {/* Help user select a submission to see reviews */}
              {!viewingSubmissionId ? (
                <div className="space-y-4">
                  {completedTasks.length === 0 && pendingTasks.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                      <Star className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">暂无互评记录</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-500">选择一个作业查看收到的评价：</p>
                      {myTasks.map((task) => (
                        <Card
                          key={task.id}
                          className="bg-white border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                          onClick={() => handleViewReceivedReviews(task)}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Star className="w-5 h-5 text-yellow-400" />
                                <span className="font-medium text-slate-900">{task.homework.title}</span>
                              </div>
                              <span className="text-sm text-blue-600 font-medium">查看评价 →</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <button
                    onClick={() => setViewingSubmissionId(null)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ← 返回列表
                  </button>

                  {reviews.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                      <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">暂未收到评价</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {reviews.map((review) => (
                        <ReviewCard key={review.id} review={review} maxScore={viewingMaxScore} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function ReviewCard({ review, maxScore }: { review: PeerReview; maxScore: number }) {
  const starCount = Math.round((review.score / maxScore) * 5);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
      {/* Quote decoration */}
      <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
        <MessageSquare className="w-16 h-16 text-blue-600" />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
          {review.anonymousLabel || '#?'}
        </div>
        <div>
          <h4 className="font-bold text-slate-800">评审员 {review.anonymousLabel}</h4>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${i < starCount ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
              />
            ))}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold text-blue-600">{review.score}</div>
          <div className="text-xs text-slate-400">评分</div>
        </div>
      </div>

      {review.comment && (
        <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 italic">
          &ldquo;{review.comment}&rdquo;
        </div>
      )}

      <div className="mt-3 text-xs text-slate-400">
        {new Date(review.createdAt).toLocaleString('zh-CN')}
      </div>
    </div>
  );
}
