import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Reel {
  has_tagged_users?: boolean | null;
  usertags?: any;
  videoplaycount: number | null;
  likescount: number | null;
  commentscount: number | null;
}

interface TaggedUsersChartProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const TaggedUsersChart = ({ 
  reels, 
  title = "Tagged Users / Collab Impact",
  description = "Performance comparison: reels with vs without tagged users"
}: TaggedUsersChartProps) => {
  const withTags = { views: 0, likes: 0, comments: 0, count: 0 };
  const withoutTags = { views: 0, likes: 0, comments: 0, count: 0 };
  
  reels.forEach(reel => {
    const hasTags = reel.has_tagged_users || (reel.usertags && Object.keys(reel.usertags).length > 0);
    const stats = hasTags ? withTags : withoutTags;
    
    stats.views += reel.videoplaycount || reel.videoviewcount || 0;
    stats.likes += reel.likescount || 0;
    stats.comments += reel.commentscount || 0;
    stats.count += 1;
  });

  const data = [
    {
      category: "With Tags",
      avgViews: withTags.count > 0 ? Math.round(withTags.views / withTags.count) : 0,
      avgLikes: withTags.count > 0 ? Math.round(withTags.likes / withTags.count) : 0,
      avgComments: withTags.count > 0 ? Math.round(withTags.comments / withTags.count) : 0,
      count: withTags.count,
    },
    {
      category: "Without Tags",
      avgViews: withoutTags.count > 0 ? Math.round(withoutTags.views / withoutTags.count) : 0,
      avgLikes: withoutTags.count > 0 ? Math.round(withoutTags.likes / withoutTags.count) : 0,
      avgComments: withoutTags.count > 0 ? Math.round(withoutTags.comments / withoutTags.count) : 0,
      count: withoutTags.count,
    },
  ];

  const impact = data[0].avgViews > 0 && data[1].avgViews > 0
    ? ((data[0].avgViews - data[1].avgViews) / data[1].avgViews * 100).toFixed(1)
    : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description}
          {impact !== "0" && (
            <span className="ml-2 font-semibold text-primary">
              ({impact}% {parseFloat(impact) > 0 ? "higher" : "lower"} with tags)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="category" 
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar dataKey="avgViews" name="Avg Views" fill="hsl(var(--chart-4))" />
            <Bar dataKey="avgLikes" name="Avg Likes" fill="hsl(var(--chart-2))" />
            <Bar dataKey="avgComments" name="Avg Comments" fill="hsl(var(--chart-3))" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold">With Tags</p>
            <p className="text-muted-foreground">{data[0].count} reels</p>
          </div>
          <div>
            <p className="font-semibold">Without Tags</p>
            <p className="text-muted-foreground">{data[1].count} reels</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaggedUsersChart;


