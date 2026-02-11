import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { useTeacherStore } from '@/stores/teacherStore';
import { useClassStore } from '@/stores/classStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Clock, Loader2, Send, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { toast } from 'sonner';

interface AlertItem {
  id: string;
  studentId: string;
  studentName: string;
  avatar?: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  behaviorScore: number;
  message: string;
  triggeredAt: string;
}

interface InterventionHistoryItem {
  id: string;
  studentId: string;
  studentName: string;
  avatar?: string;
  email: string;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export function InterventionConsolePage() {
  const { interventions, interventionStats, aiInsights, isGeneratingHomework, fetchInterventions, generateAIHomework } = useTeacherStore();
  const { classes, fetchTeacherClasses } = useClassStore();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<'all' | 'warning' | 'high'>('all');
  const [homeworkTopic, setHomeworkTopic] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enableBasic, setEnableBasic] = useState(true);
  const [enableAdvanced, setEnableAdvanced] = useState(true);
  const [enableChallenge, setEnableChallenge] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [history, setHistory] = useState<InterventionHistoryItem[]>([]);
  const [isSending, setIsSending] = useState<string | null>(null);

  const loadExtraData = async () => {
    const [alertsRes, historyRes] = await Promise.all([
      api.get('/behavior/teacher/realtime-alerts'),
      api.get('/behavior/teacher/interventions/history'),
    ]);
    setAlerts(alertsRes.data.alerts || []);
    setHistory(historyRes.data.history || []);
  };

  useEffect(() => {
    fetchInterventions();
    fetchTeacherClasses();
    loadExtraData();
  }, []);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) setSelectedClassId(classes[0].id);
  }, [classes]);

  const filteredInterventions = useMemo(() => {
    return interventions.filter((s) => {
      if (filter === 'warning') return s.behaviorScore < 50;
      if (filter === 'high') return s.behaviorScore >= 80;
      return true;
    });
  }, [interventions, filter]);

  const handlePublish = async () => {
    if (!homeworkTopic.trim() || !selectedClassId) {
      toast.error('请填写作业主题并选择班级');
      return;
    }
    await generateAIHomework(homeworkTopic.trim(), selectedClassId);
    toast.success('分层作业已发布');
    setHomeworkTopic('');
  };

  const handleSendReminder = async (studentId: string, studentName: string) => {
    setIsSending(studentId);
    try {
      await api.post(`/behavior/teacher/interventions/${studentId}/remind`, {
        message: '系统检测到您近期学习行为存在风险，请及时完成课程任务并联系教师获取学习支持。',
      });
      toast.success(`已向 ${studentName} 发送提醒`);
      await Promise.all([fetchInterventions(), loadExtraData()]);
    } finally {
      setIsSending(null);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score < 50) return <Badge className="bg-red-100 text-red-700">高风险</Badge>;
    if (score < 80) return <Badge className="bg-yellow-100 text-yellow-700">中风险</Badge>;
    return <Badge className="bg-green-100 text-green-700">稳定</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">干预控制台</h1>
          <p className="mt-1 text-sm text-slate-600">保留干预列表、AI 分层作业生成、学生风险卡片，并接入实时预警与历史时间线。</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2"><Clock className="h-4 w-4" />历史记录</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>干预历史时间线</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between"><p className="font-medium">{item.studentName}</p><Badge variant="outline">{item.priority}</Badge></div>
                  <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('zh-CN')} · {item.type} · {item.status}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.description || '无备注'}</p>
                </div>
              ))}
              {history.length === 0 && <p className="py-8 text-center text-sm text-slate-500">暂无历史记录</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">本周预警学生</p><p className="mt-2 text-2xl font-semibold text-red-600">{interventionStats?.warningCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">待处理干预</p><p className="mt-2 text-2xl font-semibold">{interventionStats?.pendingInterventions ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">紧急干预</p><p className="mt-2 text-2xl font-semibold text-amber-600">{interventionStats?.urgentCount ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-slate-500">平均积分</p><p className="mt-2 text-2xl font-semibold text-blue-700">{interventionStats?.avgPoints ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>实时预警通知</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Avatar className="h-9 w-9"><AvatarImage src={alert.avatar} /><AvatarFallback>{alert.studentName[0]}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{alert.studentName}</p>
                <p className="truncate text-xs text-slate-500">{alert.message}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{new Date(alert.triggeredAt).toLocaleTimeString('zh-CN')}</p>
                {getScoreBadge(alert.behaviorScore)}
              </div>
              <Button size="sm" className="gap-1" variant="outline" onClick={() => handleSendReminder(alert.studentId, alert.studentName)} disabled={isSending === alert.studentId}>
                {isSending === alert.studentId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}提醒
              </Button>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-slate-500">暂无实时预警</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>学生干预列表</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>全部</Button>
              <Button size="sm" variant={filter === 'warning' ? 'default' : 'outline'} onClick={() => setFilter('warning')}>预警</Button>
              <Button size="sm" variant={filter === 'high' ? 'default' : 'outline'} onClick={() => setFilter('high')}>高分</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredInterventions.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar className="h-9 w-9"><AvatarImage src={item.avatar} /><AvatarFallback>{item.studentName[0]}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="text-sm font-medium">{item.studentName}</p>{getScoreBadge(item.behaviorScore)}</div>
                  <p className="truncate text-xs text-slate-500">AI 建议：{item.aiRecommendation}</p>
                </div>
                <Badge variant="outline">{item.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => navigate('/teacher/behavior')}>查看</Button>
              </div>
            ))}
            {filteredInterventions.length === 0 && <p className="text-sm text-slate-500">暂无干预对象</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>AI 分层作业发布</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">作业主题</label>
              <input id="homework-topic-input" className="w-full rounded-md border px-3 py-2 text-sm" value={homeworkTopic} onChange={(e) => setHomeworkTopic(e.target.value)} placeholder="例如：空间向量基础" />
            </div>
            <div>
              <label className="mb-1 block text-sm">目标班级</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between"><span className="text-sm">基础层</span><Switch checked={enableBasic} onCheckedChange={setEnableBasic} /></div>
              <div className="flex items-center justify-between"><span className="text-sm">进阶层</span><Switch checked={enableAdvanced} onCheckedChange={setEnableAdvanced} /></div>
              <div className="flex items-center justify-between"><span className="text-sm">挑战层</span><Switch checked={enableChallenge} onCheckedChange={setEnableChallenge} /></div>
            </div>
            <p className="text-xs text-slate-500">AI 洞察：{aiInsights || '暂无'} </p>
            <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePublish} disabled={isGeneratingHomework}>
              {isGeneratingHomework ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}AI 生成并发布
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
