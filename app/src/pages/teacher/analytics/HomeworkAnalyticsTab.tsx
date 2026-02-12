import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HomeworkStats, ScoreDistribution, ComprehensiveStats } from '@/stores/analyticsStore';
import { BarChart as BaseBarChart } from '@/components/charts/BarChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import { TrendingUp } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

interface HomeworkAnalyticsTabProps {
  homeworkStats: HomeworkStats[];
  scoreDistribution: ScoreDistribution[] | null;
  comprehensiveStats: ComprehensiveStats | null;
  trendCompare: Array<{ homeworkTitle: string; averagePercentage: number }>;
  groupCompare: Array<{ groupName: string; averagePercentage: number }>;
}

export function HomeworkAnalyticsTab({ homeworkStats, scoreDistribution, comprehensiveStats, trendCompare, groupCompare }: HomeworkAnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* 作业提交率 + 单次作业成绩分布 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>作业提交率</CardTitle></CardHeader>
          <CardContent className="h-80">
            <BaseBarChart data={homeworkStats.map((h) => ({ name: h.title.slice(0, 8), value: h.statistics.submissionRate }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>单次作业成绩分布</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scoreDistribution || []} dataKey="count" nameKey="label" outerRadius={100}>
                  {(scoreDistribution || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 作业趋势：平均分/最高分/最低分 */}
      {comprehensiveStats && comprehensiveStats.homeworkTrend.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />作业成绩趋势（均分/最高/最低）</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comprehensiveStats.homeworkTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg" name="平均分" stroke="#3b82f6" strokeWidth={2} dot />
                <Line type="monotone" dataKey="highest" name="最高分" stroke="#22c55e" strokeWidth={1} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="lowest" name="最低分" stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 趋势对比 + 分组对比 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>成绩趋势对比</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="homeworkTitle" hide />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="averagePercentage" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>分组成绩对比</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="groupName" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="averagePercentage" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
