import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface PieChartProps {
  data: { name: string; value: number }[];
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
}

export function PieChart({
  data,
  colors = ['#2563EB', '#E5E7EB'],
  innerRadius = 60,
  outerRadius = 80,
}: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RePieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={90}
          endAngle={-270}
          dataKey="value"
          stroke="none"
        >
          {data.map((_item, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
      </RePieChart>
    </ResponsiveContainer>
  );
}
