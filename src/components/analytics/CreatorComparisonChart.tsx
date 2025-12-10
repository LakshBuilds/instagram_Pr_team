import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Reel {
  ownerusername: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  videoplaycount: number | null;
  videoviewcount?: number | null;
  likescount: number | null;
  commentscount: number | null;
  payout: number | null;
}

interface CreatorComparisonChartProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const CreatorComparisonChart = ({ 
  reels, 
  title = "Creator Comparison",
  description = "Performance comparison across Instagram accounts"
}: CreatorComparisonChartProps) => {
  const creatorStats: { [key: string]: { 
    views: number; 
    likes: number; 
    comments: number; 
    payout: number;
    count: number;
    name: string;
  } } = {};
  
  // Group by ownerusername (Instagram account that owns the reel)
  reels.forEach(reel => {
    // Use ownerusername as the primary grouping key (the Instagram account)
    if (!reel.ownerusername) return; // Skip reels without username
    
    // Normalize username (lowercase, trim) to avoid duplicates from case differences
    const normalizedUsername = reel.ownerusername.toLowerCase().trim();
    const creatorKey = normalizedUsername;
    const creatorName = reel.ownerusername;
    
    if (!creatorStats[creatorKey]) {
      creatorStats[creatorKey] = { 
        views: 0, 
        likes: 0, 
        comments: 0, 
        payout: 0,
        count: 0,
        name: creatorName,
      };
    }
    
    creatorStats[creatorKey].views += reel.videoplaycount || reel.videoviewcount || 0;
    creatorStats[creatorKey].likes += reel.likescount || 0;
    // Handle commentscount as potentially string (like Dashboard does)
    const comments = typeof reel.commentscount === 'string' 
      ? parseInt(reel.commentscount || '0', 10) 
      : (reel.commentscount || 0);
    creatorStats[creatorKey].comments += comments;
    creatorStats[creatorKey].payout += parseFloat(String(reel.payout)) || 0;
    creatorStats[creatorKey].count += 1;
  });

  const data = Object.entries(creatorStats)
    .map(([key, stats]) => ({
      creator: stats.name.length > 15 ? stats.name.substring(0, 15) + "..." : stats.name,
      fullName: stats.name,
      totalViews: stats.views,
      totalLikes: stats.likes,
      totalComments: stats.comments,
      avgViews: Math.round(stats.views / stats.count),
      avgLikes: Math.round(stats.likes / stats.count),
      avgComments: Math.round(stats.comments / stats.count),
      totalPayout: parseFloat(stats.payout.toFixed(2)),
      count: stats.count,
    }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10); // Top 10 creators by total views

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p>No creator data available</p>
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
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              type="number"
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis 
              type="category"
              dataKey="creator" 
              width={150}
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold text-base">@{data.fullName}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium text-chart-4">Total Views: {data.totalViews.toLocaleString()}</p>
                        <p className="text-sm font-medium text-chart-2">Total Likes: {data.totalLikes.toLocaleString()}</p>
                        <p className="text-sm font-medium text-chart-3">Total Comments: {data.totalComments.toLocaleString()}</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border space-y-1">
                        <p className="text-xs text-muted-foreground">Avg Views/Reel: {data.avgViews.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Avg Likes/Reel: {data.avgLikes.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Avg Comments/Reel: {data.avgComments.toLocaleString()}</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-sm">Total Payout: <span className="font-semibold">₹{data.totalPayout.toFixed(2)}</span></p>
                        <p className="text-xs text-muted-foreground">{data.count} reels</p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar dataKey="totalViews" name="Total Views" fill="hsl(var(--chart-4))" />
            <Bar dataKey="totalLikes" name="Total Likes" fill="hsl(var(--chart-2))" />
            <Bar dataKey="totalComments" name="Total Comments" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CreatorComparisonChart;

