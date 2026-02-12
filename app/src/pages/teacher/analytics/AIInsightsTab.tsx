import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface AIReport {
  classId: string;
  generatedAt: string;
  submissionRate: number;
  latestHomeworkInsights: { homeworkId: string; title: string; submitRate: number; avgScore: number }[];
  summary: string;
}

interface AIInsightsTabProps {
  aiReport: AIReport | null;
  onRefresh: () => void;
}

export function AIInsightsTab({ aiReport, onRefresh }: AIInsightsTabProps) {
  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" />AI 学情分析报告</CardTitle>
            <Button variant="outline" size="sm" onClick={onRefresh}><Sparkles className="mr-2 h-4 w-4" />刷新 AI 报告</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700">{aiReport?.summary || '暂无报告'}</p>
          <div className="mt-3 space-y-2 text-sm">
            {aiReport?.latestHomeworkInsights.map((h) => (
              <div key={h.homeworkId} className="rounded border bg-white p-2">{h.title} · 提交率 {h.submitRate}% · 均分 {h.avgScore}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
