import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Reel {
  videoplaycount: number | null;
  payout: number | string | null; // Can be number or string from database
  ownerusername: string | null;
  caption: string | null;
}

interface RevenueScatterChartProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const RevenueScatterChart = ({ 
  reels, 
  title = "Revenue Trends",
  description = "Per video views vs payout relationship"
}: RevenueScatterChartProps) => {
  const data = reels
    .filter(reel => reel.videoplaycount && reel.videoplaycount > 0 && reel.payout !== null && reel.payout !== undefined)
    .map(reel => {
      const views = reel.videoplaycount || 0;
      const payoutValue = typeof reel.payout === 'number' ? reel.payout : parseFloat(String(reel.payout || '0'));
      
      return {
        views,
        payout: parseFloat(payoutValue.toFixed(2)),
        ownerusername: reel.ownerusername || "Unknown",
        caption: reel.caption ? (reel.caption.length > 30 ? reel.caption.substring(0, 30) + "..." : reel.caption) : "",
      };
    })
    .sort((a, b) => a.views - b.views);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No data available for revenue analysis
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
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              type="number"
              dataKey="views" 
              name="Views"
              label={{ value: 'Views per Video', position: 'insideBottom', offset: -5 }}
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis 
              type="number"
              dataKey="payout" 
              name="Payout"
              label={{ value: 'Payout (₹)', angle: -90, position: 'insideLeft' }}
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">Views: {data.views.toLocaleString()}</p>
                      <p className="font-semibold text-primary">Payout: ₹{data.payout.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground mt-1">Creator: {data.ownerusername}</p>
                      {data.caption && (
                        <p className="text-xs text-muted-foreground mt-1">{data.caption}</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="Reels" data={data} fill="hsl(var(--chart-5))">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>Total reels analyzed: {data.length}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueScatterChart;


