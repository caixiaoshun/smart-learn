import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PeerReviewStats } from '@/stores/analyticsStore';
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, ScatterChart, Scatter } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface EvaluationAnalyticsTabProps {
  peerReviewStats: PeerReviewStats | null;
}

export function EvaluationAnalyticsTab({ peerReviewStats }: EvaluationAnalyticsTabProps) {
  if (!peerReviewStats) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />评价分析（自评/互评）</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Self-assessment distribution */}
            <div>
              <p className="text-sm font-medium mb-2">自评分数分布 (平均: {peerReviewStats.selfAssessment.average})</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peerReviewStats.selfAssessment.distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Peer review distribution */}
            <div>
              <p className="text-sm font-medium mb-2">互评分数分布 (平均: {peerReviewStats.peerReview.average}, 一致性σ: {peerReviewStats.peerReview.consistencyStdDev})</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peerReviewStats.peerReview.distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Self vs Teacher scatter */}
            <div>
              <p className="text-sm font-medium mb-2">自评 vs 教师评分偏差</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="selfScore" name="自评分" domain={[0, 100]} />
                    <YAxis type="number" dataKey="teacherScore" name="教师评分" domain={[0, 100]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="偏差分析" data={peerReviewStats.selfVsTeacher} fill="#3b82f6" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
