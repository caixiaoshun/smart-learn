import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useClassStore } from '@/stores/classStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, BarChart3, ClipboardList, Users, MessageSquare, Bot } from 'lucide-react';
import { OverviewTab } from './analytics/OverviewTab';
import { HomeworkAnalyticsTab } from './analytics/HomeworkAnalyticsTab';
import { StudentProfilesTab } from './analytics/StudentProfilesTab';
import { EvaluationAnalyticsTab } from './analytics/EvaluationAnalyticsTab';
import { AIInsightsTab } from './analytics/AIInsightsTab';
import { StudentProfileDialog } from './analytics/StudentProfileDialog';

interface AIReport {
  classId: string;
  generatedAt: string;
  submissionRate: number;
  latestHomeworkInsights: { homeworkId: string; title: string; submitRate: number; avgScore: number }[];
  summary: string;
}

const TAB_KEYS = ['overview', 'homework', 'students', 'evaluation', 'ai'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export function AnalyticsPage() {
  const { classes, fetchTeacherClasses } = useClassStore();
  const store = useAnalyticsStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedHomeworkId, setSelectedHomeworkId] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>((searchParams.get('tab') as TabKey) || 'overview');
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['overview']));
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [trendCompare, setTrendCompare] = useState<Array<{ homeworkTitle: string; averagePercentage: number }>>([]);
  const [groupCompare, setGroupCompare] = useState<Array<{ groupName: string; averagePercentage: number }>>([]);
  const [clusterMethod, setClusterMethod] = useState<'threshold' | 'kmeans'>('threshold');
  const [clusterK, setClusterK] = useState(3);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const loadTabData = useCallback(async (tab: string, classId: string, hwId?: string) => {
    if (!classId) return;
    switch (tab) {
      case 'overview':
        await Promise.all([store.fetchComprehensiveStats(classId), store.fetchGradeComposition(classId), store.fetchIndicatorRadar(classId), store.fetchClassOverview(classId)]);
        break;
      case 'homework': {
        const trendRes = await api.get(`/analytics/class/${classId}/trend-compare`);
        setTrendCompare((trendRes.data.trend || []).map((t: any) => ({ homeworkTitle: t.homeworkTitle, averagePercentage: t.averagePercentage })));
        if (hwId) {
          const groupRes = await api.get(`/analytics/homework/${hwId}/group-compare`);
          setGroupCompare((groupRes.data.groups || []).map((g: any) => ({ groupName: g.groupName, averagePercentage: g.averagePercentage })));
        }
        break;
      }
      case 'students':
        await Promise.all([store.fetchStudentClusters(classId, clusterMethod, clusterK), store.fetchPerformanceScatter(classId), store.fetchPerformanceHeatmap(classId)]);
        break;
      case 'evaluation': await store.fetchPeerReviewStats(classId); break;
      case 'ai': { const r = await api.get(`/analytics/class/${classId}/ai-report`); setAiReport(r.data.report || null); break; }
    }
  }, [store, clusterMethod, clusterK]);

  useEffect(() => { fetchTeacherClasses(); }, []);
  useEffect(() => { if (classes.length > 0 && !selectedClassId) setSelectedClassId(classes[0].id); }, [classes]);
  useEffect(() => { if (store.homeworkStats.length > 0 && !selectedHomeworkId) setSelectedHomeworkId(store.homeworkStats[0].id); }, [store.homeworkStats]);
  useEffect(() => { if (selectedHomeworkId) store.fetchScoreDistribution(selectedHomeworkId); }, [selectedHomeworkId]);

  useEffect(() => {
    if (!selectedClassId) return;
    store.fetchClassHomeworkStats(selectedClassId);
    const initial = new Set([activeTab]);
    setLoadedTabs(initial);
    loadTabData(activeTab, selectedClassId, selectedHomeworkId);
  }, [selectedClassId]);

  const handleTabChange = (tab: string) => {
    const t = tab as TabKey;
    setActiveTab(t);
    setSearchParams({ tab: t });
    if (!loadedTabs.has(t)) {
      loadTabData(t, selectedClassId, selectedHomeworkId);
      setLoadedTabs(prev => new Set(prev).add(t));
    }
  };

  const refreshAIReport = async () => {
    if (!selectedClassId) return;
    const reportRes = await api.get(`/analytics/class/${selectedClassId}/ai-report`);
    setAiReport(reportRes.data.report || null);
  };

  const homeworkOptions = useMemo(() => store.homeworkStats.map((h) => ({ id: h.id, title: h.title })), [store.homeworkStats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">数据分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">班级 / 作业联动分析、学生聚类、成绩分布与 AI 学情报告。</p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-md border px-3 py-2" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="rounded-md border px-3 py-2" value={selectedHomeworkId} onChange={(e) => setSelectedHomeworkId(e.target.value)}>
            {homeworkOptions.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
          </select>
          <Button variant="outline" onClick={refreshAIReport}><Sparkles className="mr-2 h-4 w-4" />刷新 AI 报告</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview"><BarChart3 className="mr-1 h-4 w-4" />总览</TabsTrigger>
          <TabsTrigger value="homework"><ClipboardList className="mr-1 h-4 w-4" />作业分析</TabsTrigger>
          <TabsTrigger value="students"><Users className="mr-1 h-4 w-4" />学生画像</TabsTrigger>
          <TabsTrigger value="evaluation"><MessageSquare className="mr-1 h-4 w-4" />评价分析</TabsTrigger>
          <TabsTrigger value="ai"><Bot className="mr-1 h-4 w-4" />AI 报告</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab comprehensiveStats={store.comprehensiveStats} gradeComposition={store.gradeComposition} indicatorRadar={store.indicatorRadar} classOverview={store.classOverview} />
        </TabsContent>
        <TabsContent value="homework">
          <HomeworkAnalyticsTab homeworkStats={store.homeworkStats} scoreDistribution={store.scoreDistribution} comprehensiveStats={store.comprehensiveStats} trendCompare={trendCompare} groupCompare={groupCompare} />
        </TabsContent>
        <TabsContent value="students">
          <StudentProfilesTab studentClusters={store.studentClusters} scatterData={store.scatterData} heatmapData={store.heatmapData} clusterMethod={clusterMethod} clusterK={clusterK} onClusterMethodChange={(m) => { setClusterMethod(m); if (selectedClassId) store.fetchStudentClusters(selectedClassId, m, clusterK); }} onClusterKChange={(k) => { setClusterK(k); if (selectedClassId) store.fetchStudentClusters(selectedClassId, 'kmeans', k); }} onStudentClick={(sid) => { if (selectedClassId) { store.fetchStudentProfile(selectedClassId, sid); setProfileDialogOpen(true); } }} />
        </TabsContent>
        <TabsContent value="evaluation">
          <EvaluationAnalyticsTab peerReviewStats={store.peerReviewStats} />
        </TabsContent>
        <TabsContent value="ai">
          <AIInsightsTab aiReport={aiReport} onRefresh={refreshAIReport} />
        </TabsContent>
      </Tabs>

      <StudentProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} studentProfile={store.studentProfile} />
      {store.isLoading && <p className="text-sm text-muted-foreground">加载中...</p>}
    </div>
  );
}
