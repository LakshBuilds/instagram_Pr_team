import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

interface ViewsGrowthData {
  date: string;
  views_growth: number;
  likes_growth: number;
  cumulative_views: number;
}

interface ViewsGrowthChartProps {
  data: ViewsGrowthData[];
  title?: string;
  description?: string;
}

const ViewsGrowthChart = ({ 
  data, 
  title = "Views Growth Over Time",
  description = "Track how views are growing based on update timestamps (not posting date)"
}: ViewsGrowthChartProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No views history data available. Refresh your reels to start tracking.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}K` : value}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString(),
                  name === 'views_growth' ? 'Views Growth' : 
                  name === 'likes_growth' ? 'Likes Growth' : 
                  'Cumulative Views'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="views_growth" 
                name="Views Growth"
                stroke="hsl(var(--chart-4))" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="likes_growth" 
                name="Likes Growth"
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="cumulative_views" 
                name="Cumulative Views"
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ViewsGrowthChart;