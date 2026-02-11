import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useClassStore } from '@/stores/classStore';
import { useClassPerformanceStore } from '@/stores/classPerformanceStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadarChart } from '@/components/charts/RadarChart';
import { BookOpen, Download, Plus, Trash2 } from 'lucide-react';
import type { PerformanceType } from '@/types';

const TYPE_META: Record<PerformanceType, { label: string; badge: string }> = {
  CLASSROOM_QA: { label: '课堂问答', badge: 'bg-blue-100 text-blue-700' },
  KNOWLEDGE_SHARE: { label: '知识分享', badge: 'bg-purple-100 text-purple-700' },
};

const MASTERY = ['完全不了解', '初步了解', '基本掌握', '熟练运用', '融会贯通'];

export function ClassPerformancePage() {
  const { classes, fetchTeacherClasses, fetchClassDetail } = useClassStore();
  const {
    records,
    summary,
    knowledgePoints,
    knowledgeDistribution,
    scoringRules,
    isLoading,
    createRecord,
    fetchRecords,
    deleteRecord,
    fetchSummary,
    exportRecords,
    fetchScoringRules,
    updateScoringRules,
    publishKnowledgePoints,
    fetchKnowledgePoints,
    fetchKnowledgeDistribution,
  } = useClassPerformanceStore();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'summary' | 'knowledge'>('records');
  const [radarData, setRadarData] = useState<{ subject: string; value: number; fullMark: number }[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [recordType, setRecordType] = useState<PerformanceType>('CLASSROOM_QA');
  const [recordStudentId, setRecordStudentId] = useState('');
  const [recordTopic, setRecordTopic] = useState('');
  const [recordScore, setRecordScore] = useState('3');
  const [recordNotes, setRecordNotes] = useState('');

  const [isKpOpen, setIsKpOpen] = useState(false);
  const [kpItems, setKpItems] = useState([{ title: '', description: '' }]);

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [ruleMaxScore, setRuleMaxScore] = useState('5');
  const [ruleQaWeight, setRuleQaWeight] = useState('50');
  const [ruleShareWeight, setRuleShareWeight] = useState('50');

  useEffect(() => {
    fetchTeacherClasses();
  }, []);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) setSelectedClassId(classes[0].id);
  }, [classes]);

  const loadClassData = async (classId: string) => {
    await Promise.all([
      fetchClassDetail(classId),
      fetchRecords(classId),
      fetchSummary(classId),
      fetchKnowledgePoints(classId),
      fetchKnowledgeDistribution(classId),
      fetchScoringRules(classId).catch(() => { /* use defaults if fetch fails */ }),
    ]);
    const { data } = await api.get(`/class-performance/knowledge-radar/${classId}`);
    setRadarData(data.radar || []);
  };

  useEffect(() => {
    if (selectedClassId) loadClassData(selectedClassId);
  }, [selectedClassId]);

  const currentClass = classes.find((c) => c.id === selectedClassId);
  const students = currentClass?.students || [];

  const aiInsight = useMemo(() => {
    if (!knowledgeDistribution.length) return '暂无知识点自评数据。';
    const weakest = [...knowledgeDistribution].sort((a, b) => a.averageLevel - b.averageLevel)[0];
    const weakPct = weakest.totalAssessments > 0 ? Math.round(((weakest.levelDistribution.level1 + weakest.levelDistribution.level2) / weakest.totalAssessments) * 100) : 0;
    return `根据数据，${weakest.title} 的平均掌握度为 ${weakest.averageLevel.toFixed(1)}，其中 ${weakPct}% 学生处于“需加强”区间。建议安排针对性复盘练习。`;
  }, [knowledgeDistribution]);

  const handleCreateRecord = async () => {
    if (!selectedClassId || !recordStudentId) {
      toast.error('请选择班级和学生');
      return;
    }
    await createRecord({
      classId: selectedClassId,
      studentId: recordStudentId,
      type: recordType,
      topic: recordTopic || undefined,
      score: Number(recordScore),
      notes: recordNotes || undefined,
    });
    setIsCreateOpen(false);
    setRecordStudentId('');
    setRecordTopic('');
    setRecordScore('3');
    setRecordNotes('');
    await loadClassData(selectedClassId);
  };

  const handlePublishKnowledgePoints = async () => {
    const valid = kpItems.filter((k) => k.title.trim());
    if (!selectedClassId || valid.length === 0) {
      toast.error('请至少填写一个知识点标题');
      return;
    }
    await publishKnowledgePoints(selectedClassId, valid);
    setIsKpOpen(false);
    setKpItems([{ title: '', description: '' }]);
    await loadClassData(selectedClassId);
  };

  const handleOpenRuleDialog = () => {
    setRuleMaxScore(String(scoringRules.maxScore));
    setRuleQaWeight(String(Math.round(scoringRules.qaWeight * 100)));
    setRuleShareWeight(String(Math.round(scoringRules.shareWeight * 100)));
    setIsRuleDialogOpen(true);
  };

  const handleSaveRules = async () => {
    if (!selectedClassId) return;
    const qaW = Number(ruleQaWeight) / 100;
    const shareW = Number(ruleShareWeight) / 100;
    if (Math.abs(qaW + shareW - 1) > 0.01) {
      toast.error('课堂问答权重与知识分享权重之和必须等于 100%');
      return;
    }
    try {
      await updateScoringRules(selectedClassId, {
        maxScore: Number(ruleMaxScore),
        qaWeight: qaW,
        shareWeight: shareW,
      });
      toast.success('评分规则已更新');
      setIsRuleDialogOpen(false);
      await fetchSummary(selectedClassId);
    } catch {
      toast.error('更新评分规则失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">平时表现管理中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">记录课堂互动、知识分享与知识点掌握度。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenRuleDialog}>评分规则设置</Button>
          {selectedClassId && <Button onClick={() => exportRecords(selectedClassId, 'csv')}><Download className="mr-2 h-4 w-4" />一键导出到成绩册</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-md border px-3 py-2" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClassId && (
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />新建记录</Button>
            <Button variant="outline" onClick={() => setIsKpOpen(true)}><BookOpen className="mr-2 h-4 w-4" />发布知识点</Button>
          </>
        )}
      </div>

      {selectedClassId && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'records' | 'summary' | 'knowledge')}>
          <TabsList>
            <TabsTrigger value="records">记录</TabsTrigger>
            <TabsTrigger value="summary">汇总</TabsTrigger>
            <TabsTrigger value="knowledge">知识点</TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>课堂与分享记录</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {records.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{record.student.name}</p>
                          <Badge className={TYPE_META[record.type].badge}>{TYPE_META[record.type].label}</Badge>
                          <Badge variant="outline">{record.score ?? '-'} 分</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{record.topic || '无主题'} · {new Date(record.occurredAt).toLocaleString('zh-CN')}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deleteRecord(record.id).then(() => selectedClassId && loadClassData(selectedClassId))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {!records.length && <p className="text-sm text-muted-foreground">暂无记录</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>学生表现汇总</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.map((s) => (
                    <div key={s.student.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between"><p className="font-medium">{s.student.name}</p><Badge>综合 {s.compositeScore}</Badge></div>
                      <p className="mt-1 text-sm text-muted-foreground">问答 {s.qaCount} 次（均分 {s.qaAvgScore}） · 分享 {s.shareCount} 次（均分 {s.shareAvgScore}）</p>
                    </div>
                  ))}
                  {!summary.length && <p className="text-sm text-muted-foreground">暂无汇总数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge" className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>知识点掌握度统计</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {knowledgeDistribution.map((k) => (
                  <div key={k.id}>
                    <div className="mb-1 flex justify-between text-sm"><span>{k.title}</span><span>平均 {k.averageLevel}/5</span></div>
                    <div className="grid grid-cols-5 gap-1 text-[11px] text-muted-foreground">
                      {[1, 2, 3, 4, 5].map((level) => {
                        const count = k.levelDistribution[`level${level}` as 'level1' | 'level2' | 'level3' | 'level4' | 'level5'];
                        return <div key={level} className="rounded bg-slate-100 p-1 text-center">L{level}:{count}</div>;
                      })}
                    </div>
                  </div>
                ))}
                {!knowledgeDistribution.length && <p className="text-sm text-muted-foreground">暂无知识点评估数据</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>掌握度雷达图</CardTitle></CardHeader>
              <CardContent className="h-72"><RadarChart data={radarData} /></CardContent>
            </Card>
            <Card className="lg:col-span-3 border-blue-200 bg-blue-50/50">
              <CardContent className="p-4 text-sm text-slate-700">AI 学情分析：{aiInsight}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建记录</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select className="w-full rounded-md border px-3 py-2" value={recordType} onChange={(e) => setRecordType(e.target.value as PerformanceType)}>
              <option value="CLASSROOM_QA">课堂问答</option>
              <option value="KNOWLEDGE_SHARE">知识分享</option>
            </select>
            <select className="w-full rounded-md border px-3 py-2" value={recordStudentId} onChange={(e) => setRecordStudentId(e.target.value)}>
              <option value="">请选择学生</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Input placeholder="主题（可选）" value={recordTopic} onChange={(e) => setRecordTopic(e.target.value)} />
            <Input type="number" min={1} max={5} value={recordScore} onChange={(e) => setRecordScore(e.target.value)} />
            <Textarea placeholder="备注" value={recordNotes} onChange={(e) => setRecordNotes(e.target.value)} rows={3} />
            <Button onClick={handleCreateRecord}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isKpOpen} onOpenChange={setIsKpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>发布知识点</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {kpItems.map((item, i) => (
              <div key={i} className="space-y-2 rounded border p-2">
                <Input placeholder={`知识点 ${i + 1}`} value={item.title} onChange={(e) => setKpItems((prev) => prev.map((p, idx) => idx === i ? { ...p, title: e.target.value } : p))} />
                <Textarea placeholder="描述（可选）" rows={2} value={item.description} onChange={(e) => setKpItems((prev) => prev.map((p, idx) => idx === i ? { ...p, description: e.target.value } : p))} />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setKpItems((prev) => [...prev, { title: '', description: '' }])}>新增一条</Button>
              {kpItems.length > 1 && <Button variant="outline" onClick={() => setKpItems((prev) => prev.slice(0, -1))}>删除最后一条</Button>}
            </div>
            <Button onClick={handlePublishKnowledgePoints}>发布</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>评分规则设置</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">单次评分满分</label>
              <Input type="number" min={1} max={100} value={ruleMaxScore} onChange={(e) => setRuleMaxScore(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">课堂问答权重（%）</label>
              <Input type="number" min={0} max={100} value={ruleQaWeight} onChange={(e) => {
                setRuleQaWeight(e.target.value);
                setRuleShareWeight(String(100 - Number(e.target.value)));
              }} />
            </div>
            <div>
              <label className="text-sm font-medium">知识分享权重（%）</label>
              <Input type="number" min={0} max={100} value={ruleShareWeight} onChange={(e) => {
                setRuleShareWeight(e.target.value);
                setRuleQaWeight(String(100 - Number(e.target.value)));
              }} />
            </div>
            <p className="text-xs text-muted-foreground">课堂问答与知识分享权重之和需等于 100%。</p>
            <Button onClick={handleSaveRules}>保存规则</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
