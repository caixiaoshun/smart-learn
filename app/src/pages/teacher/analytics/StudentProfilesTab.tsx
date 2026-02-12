import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StudentClusterItem, ClusterSummary, HeatmapData } from '@/stores/analyticsStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, CartesianGrid, XAxis, YAxis, ZAxis, ScatterChart, Scatter } from 'recharts';
import { Users, Target, User } from 'lucide-react';
import { clusterBadge } from './clusterBadge';

interface StudentProfilesTabProps {
  studentClusters: {
    method?: string;
    silhouetteScore?: number;
    clusters: { HIGH: StudentClusterItem[]; MEDIUM: StudentClusterItem[]; AT_RISK: StudentClusterItem[] };
    summary: ClusterSummary;
    totalStudents: number;
  } | null;
  scatterData: { points: { name: string; studentId: string; x: number; y: number }[]; xLabel: string; yLabel: string } | null;
  heatmapData: HeatmapData | null;
  clusterMethod: 'threshold' | 'kmeans';
  clusterK: number;
  onClusterMethodChange: (method: 'threshold' | 'kmeans') => void;
  onClusterKChange: (k: number) => void;
  onStudentClick: (studentId: string) => void;
}

export function StudentProfilesTab({ studentClusters, scatterData, heatmapData, clusterMethod, clusterK, onClusterMethodChange, onClusterKChange, onStudentClick }: StudentProfilesTabProps) {
  return (
    <div className="space-y-6">
      {/* 学生聚类分析 */}
      {studentClusters && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />学生聚类分析</CardTitle>
              <div className="flex items-center gap-2">
                <select className="rounded-md border px-2 py-1 text-sm" value={clusterMethod} onChange={(e) => onClusterMethodChange(e.target.value as 'threshold' | 'kmeans')}>
                  <option value="threshold">简单阈值</option>
                  <option value="kmeans">KMeans 聚类</option>
                </select>
                {clusterMethod === 'kmeans' && (
                  <select className="rounded-md border px-2 py-1 text-sm" value={clusterK} onChange={(e) => onClusterKChange(parseInt(e.target.value))}>
                    <option value="2">K=2</option>
                    <option value="3">K=3</option>
                    <option value="4">K=4</option>
                    <option value="5">K=5</option>
                  </select>
                )}
                {studentClusters.silhouetteScore !== undefined && (
                  <Badge variant="outline" className="text-xs">轮廓系数: {studentClusters.silhouetteScore}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm text-green-700 font-medium">优秀学生</p>
                <p className="text-3xl font-bold text-green-800">{studentClusters.summary.highCount}</p>
                <p className="text-xs text-green-600">{studentClusters.summary.highPercentage}% · 综合得分 ≥80</p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
                <p className="text-sm text-yellow-700 font-medium">中等学生</p>
                <p className="text-3xl font-bold text-yellow-800">{studentClusters.summary.mediumCount}</p>
                <p className="text-xs text-yellow-600">{studentClusters.summary.mediumPercentage}% · 综合得分 50-79</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-700 font-medium">待关注学生</p>
                <p className="text-3xl font-bold text-red-800">{studentClusters.summary.atRiskCount}</p>
                <p className="text-xs text-red-600">{studentClusters.summary.atRiskPercentage}% · 综合得分 {'<'}50</p>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ name: '优秀', value: studentClusters.summary.highCount }, { name: '中等', value: studentClusters.summary.mediumCount }, { name: '待关注', value: studentClusters.summary.atRiskCount }]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...studentClusters.clusters.AT_RISK, ...studentClusters.clusters.MEDIUM, ...studentClusters.clusters.HIGH]
                  .sort((a, b) => a.composite - b.composite)
                  .slice(0, 10)
                  .map((s) => (
                    <div key={s.student.id} className="flex items-center justify-between rounded border p-2 text-sm cursor-pointer hover:bg-slate-50" onClick={() => onStudentClick(s.student.id)}>
                      <span className="font-medium flex items-center gap-1"><User className="h-3 w-3" />{s.student.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">得分率{s.avgScoreRate}% · 提交率{s.submissionRate}%</span>
                        {clusterBadge(s.cluster)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 学生表现散点图 */}
      {scatterData && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />学生表现散点图</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name={scatterData.xLabel} domain={[0, 100]} unit="%" />
                <YAxis type="number" dataKey="y" name={scatterData.yLabel} domain={[0, 100]} unit="%" />
                <ZAxis range={[40, 200]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: number, name: string) => [`${value}%`, name === 'x' ? '提交率' : '得分率']} />
                <Scatter name="学生" data={scatterData.points} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 课堂表现热力图 */}
      {heatmapData && heatmapData.timeBuckets.length > 0 && (
        <Card>
          <CardHeader><CardTitle>课堂表现热力图</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="flex">
                  <div className="w-24 shrink-0" />
                  {heatmapData.timeBuckets.map((t, i) => (
                    <div key={i} className="flex-1 text-center text-xs text-muted-foreground truncate px-1">{t}</div>
                  ))}
                </div>
                {heatmapData.students.map((student, si) => (
                  <div key={student.id} className="flex items-center">
                    <div className="w-24 shrink-0 text-xs font-medium truncate pr-2">{student.name}</div>
                    {heatmapData.matrix[si]?.map((val, ti) => {
                      const maxVal = Math.max(1, ...heatmapData.matrix.flat());
                      const intensity = val / maxVal;
                      const bg = val === 0 ? 'bg-slate-100' : intensity > 0.7 ? 'bg-green-500' : intensity > 0.4 ? 'bg-green-300' : 'bg-green-100';
                      return (
                        <div key={ti} className={`flex-1 h-8 m-0.5 rounded text-xs flex items-center justify-center ${bg}`} title={`${student.name} · ${heatmapData.timeBuckets[ti]}: ${val}分`}>
                          {val > 0 ? val : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
