import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { StudentProfile } from '@/stores/analyticsStore';
import { User } from 'lucide-react';

interface StudentProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentProfile: StudentProfile | null;
}

function clusterBadge(cluster: string) {
  if (cluster === 'HIGH') return <Badge className="bg-green-100 text-green-700">优秀</Badge>;
  if (cluster === 'MEDIUM') return <Badge className="bg-yellow-100 text-yellow-700">中等</Badge>;
  return <Badge className="bg-red-100 text-red-700">待关注</Badge>;
}

export function StudentProfileDialog({ open, onOpenChange, studentProfile }: StudentProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="h-4 w-4" />学生画像 — {studentProfile?.student.name}</DialogTitle>
        </DialogHeader>
        {studentProfile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium">{studentProfile.student.name}</p>
                <p className="text-sm text-muted-foreground">{studentProfile.student.email}</p>
              </div>
              {clusterBadge(studentProfile.metrics.cluster)}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">得分率</p><p className="font-bold">{studentProfile.metrics.avgScoreRate}%</p></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">提交率</p><p className="font-bold">{studentProfile.metrics.submissionRate}%</p></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">按时率</p><p className="font-bold">{studentProfile.metrics.onTimeRate}%</p></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">综合分</p><p className="font-bold">{studentProfile.metrics.composite}</p></div>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">作业成绩</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {studentProfile.homeworkScores.map(hw => (
                  <div key={hw.homeworkId} className="flex items-center justify-between text-xs rounded border p-1.5">
                    <span className="truncate max-w-[200px]">{hw.title}</span>
                    <span>{hw.submitted ? (hw.score !== null ? `${hw.score}/${hw.maxScore}` : '待批改') : '未提交'} {hw.onTime && <Badge variant="outline" className="ml-1 text-[10px]">按时</Badge>}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">课堂问答 ({studentProfile.performance.qa.count}次)</p>
                <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
                  {studentProfile.performance.qa.records.slice(0, 5).map((r, i) => (
                    <div key={i} className="rounded border p-1">{r.topic || '课堂问答'} · {r.score ?? '-'}分</div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">知识分享 ({studentProfile.performance.share.count}次)</p>
                <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
                  {studentProfile.performance.share.records.slice(0, 5).map((r, i) => (
                    <div key={i} className="rounded border p-1">{r.topic || '知识分享'} · {r.score ?? '-'}分</div>
                  ))}
                </div>
              </div>
            </div>
            {studentProfile.selfAssessments.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">自评记录</p>
                <div className="space-y-1 text-xs">
                  {studentProfile.selfAssessments.map((sa, i) => (
                    <div key={i} className="rounded border p-1">{sa.homeworkTitle} · 自评{sa.score}分</div>
                  ))}
                </div>
              </div>
            )}
            {(studentProfile.peerReviews.given.length > 0 || studentProfile.peerReviews.received.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">给出的互评 ({studentProfile.peerReviews.given.length})</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
                    {studentProfile.peerReviews.given.map((pr, i) => (
                      <div key={i} className="rounded border p-1">{pr.homeworkTitle} · {pr.score}分</div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">收到的互评 ({studentProfile.peerReviews.received.length})</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
                    {studentProfile.peerReviews.received.map((pr, i) => (
                      <div key={i} className="rounded border p-1">{pr.homeworkTitle} · {pr.score}分</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
