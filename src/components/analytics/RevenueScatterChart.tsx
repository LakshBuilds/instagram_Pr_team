import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Video } from "@/lib/types";

interface Props {
  videos: Video[];
  title?: string;
  description?: string;
}

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00ff00", "#0088fe", "#00c49f", "#ffbb28", "#ff8042"];

const RevenueScatterChart = ({ videos, title = "Revenue Trends", description = "Per video views vs payout relationship" }: Props) => {
  const data = videos
    .filter((v) => v.view_count && v.view_count > 0 && v.payout != null)
    .map((v) => ({
      views: v.view_count!,
      payout: +(Number(v.payout) || 0).toFixed(2),
      channel: v.channel_name || "Unknown",
      title: v.title ? (v.title.length > 30 ? v.title.substring(0, 30) + "..." : v.title) : "",
    }))
    .sort((a, b) => a.views - b.views);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">No data available for revenue analysis</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" dataKey="views" name="Views" label={{ value: "Views per Video", position: "insideBottom", offset: -5 }} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="number" dataKey="payout" name="Payout" label={{ value: "Payout (₹)", angle: -90, position: "insideLeft" }} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold">Views: {d.views.toLocaleString()}</p>
                    <p className="font-semibold text-primary">Payout: ₹{d.payout.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground mt-1">Channel: {d.channel}</p>
                    {d.title && <p className="text-xs text-muted-foreground mt-1">{d.title}</p>}
                  </div>
                );
              }}
            />
            <Scatter name="Videos" data={data} fill="hsl(var(--chart-5))">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <p className="mt-4 text-sm text-muted-foreground">Total videos analyzed: {data.length}</p>
      </CardContent>
    </Card>
  );
};

export default RevenueScatterChart;
