import {
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

interface RadarChartProps {
  data: { subject: string; value: number; fullMark: number }[];
  color?: string;
}

export function RadarChart({ data, color = '#2563EB' }: RadarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis 
          dataKey="subject" 
          tick={{ fill: '#6B7280', fontSize: 12 }}
        />
        <PolarRadiusAxis 
          angle={30} 
          domain={[0, 100]} 
          tick={false}
          axisLine={false}
        />
        <Radar
          name="能力值"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </ReRadarChart>
    </ResponsiveContainer>
  );
}
