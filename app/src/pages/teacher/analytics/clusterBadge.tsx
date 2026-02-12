import { Badge } from '@/components/ui/badge';

export function clusterBadge(cluster: string) {
  if (cluster === 'HIGH') return <Badge className="bg-green-100 text-green-700">优秀</Badge>;
  if (cluster === 'MEDIUM') return <Badge className="bg-yellow-100 text-yellow-700">中等</Badge>;
  return <Badge className="bg-red-100 text-red-700">待关注</Badge>;
}
