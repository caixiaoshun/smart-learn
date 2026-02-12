import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComprehensiveStats, GradeComposition, IndicatorRadarItem, ClassOverview } from '@/stores/analyticsStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { BarChart3, Target } from 'lucide-react';

interface OverviewTabProps {
  comprehensiveStats: ComprehensiveStats | null;
  gradeComposition: GradeComposition | null;
  indicatorRadar: IndicatorRadarItem[] | null;
  classOverview: ClassOverview | null;
}

export function OverviewTab({ comprehensiveStats, gradeComposition, indicatorRadar, classOverview }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* 综合统计卡片 */}
      {comprehensiveStats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">学生人数</p><p className="text-2xl font-bold">{comprehensiveStats.overview.studentCount}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">平均分</p><p className="text-2xl font-bold text-green-700">{comprehensiveStats.overview.avgScore}%</p><p className="text-xs text-muted-foreground mt-1">中位数 {comprehensiveStats.overview.medianScore}% · 标准差 {comprehensiveStats.overview.stdDev}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">及格率 / 优秀率</p><p className="text-2xl font-bold text-blue-700">{comprehensiveStats.overview.passRate}% / {comprehensiveStats.overview.excellentRate}%</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">作业数 / 总评分</p><p className="text-2xl font-bold">{comprehensiveStats.overview.homeworkCount} / {comprehensiveStats.overview.totalScored}</p></CardContent></Card>
        </div>
      )}

      {/* 成绩构成环形图 + 指标体系雷达图 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {gradeComposition && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />成绩构成分析</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gradeComposition.composition} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                    {gradeComposition.composition.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {indicatorRadar && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />班级指标体系雷达</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={indicatorRadar}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="班级指标" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 综合成绩分布 */}
      {comprehensiveStats && (
        <Card>
          <CardHeader><CardTitle>综合成绩分布</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={comprehensiveStats.scoreDistribution} dataKey="count" nameKey="label" innerRadius={50} outerRadius={100} label={({ label, percentage }) => `${label}: ${percentage}%`}>
                  {comprehensiveStats.scoreDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 班级概览 */}
      <Card>
        <CardHeader><CardTitle>班级概览</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium">高分学生</p>
            <div className="space-y-2">{classOverview?.topStudents.map((s) => <div key={s.id} className="rounded border p-2 text-sm">{s.name} · 总分 {s.totalScore}</div>)}</div>
          </div>
          <div>
            <p className="mb-2 font-medium">需关注学生</p>
            <div className="space-y-2">{classOverview?.needAttention.map((s) => <div key={s.id} className="rounded border p-2 text-sm">{s.name} · 总分 {s.totalScore}</div>)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
