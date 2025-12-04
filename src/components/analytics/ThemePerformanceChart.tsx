import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Reel {
  caption: string | null;
  videoplaycount: number | null;
  likescount: number | null;
  commentscount: number | null;
}

interface ThemePerformanceChartProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const ThemePerformanceChart = ({ 
  reels, 
  title = "Theme / Caption Performance",
  description = "Performance by common themes and hashtags"
}: ThemePerformanceChartProps) => {
  // Extract themes from captions (hashtags and common words)
  const themeStats: { [key: string]: { views: number; likes: number; comments: number; count: number } } = {};
  
  const commonThemes = [
    'funny', 'comedy', 'meme', 'viral', 'trending', 'challenge', 'dance', 'music',
    'food', 'cooking', 'recipe', 'fitness', 'workout', 'motivation', 'inspiration',
    'fashion', 'style', 'outfit', 'beauty', 'makeup', 'skincare', 'travel', 'adventure',
    'tech', 'gadget', 'review', 'tutorial', 'tips', 'hack', 'life', 'lifestyle'
  ];

  reels
    .filter(reel => reel.caption)
    .forEach(reel => {
      const caption = (reel.caption || "").toLowerCase();
      const hashtags = caption.match(/#\w+/g) || [];
      const words = caption.split(/\s+/);
      
      // Check for common themes
      const foundThemes = new Set<string>();
      
      commonThemes.forEach(theme => {
        if (caption.includes(theme)) {
          foundThemes.add(theme);
        }
      });
      
      // Add hashtags (without #)
      hashtags.forEach(tag => {
        const tagName = tag.substring(1).toLowerCase();
        if (tagName.length > 2) {
          foundThemes.add(`#${tagName}`);
        }
      });
      
      foundThemes.forEach(theme => {
        if (!themeStats[theme]) {
          themeStats[theme] = { views: 0, likes: 0, comments: 0, count: 0 };
        }
        
        themeStats[theme].views += reel.videoplaycount || reel.videoviewcount || 0;
        themeStats[theme].likes += reel.likescount || 0;
        themeStats[theme].comments += reel.commentscount || 0;
        themeStats[theme].count += 1;
      });
    });

  const data = Object.entries(themeStats)
    .filter(([_, stats]) => stats.count >= 2) // Only show themes with at least 2 reels
    .map(([theme, stats]) => ({
      theme: theme.length > 15 ? theme.substring(0, 15) + "..." : theme,
      avgViews: Math.round(stats.views / stats.count),
      avgLikes: Math.round(stats.likes / stats.count),
      avgComments: Math.round(stats.comments / stats.count),
      count: stats.count,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 10); // Top 10 themes

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
              dataKey="theme" 
              width={120}
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
      </CardContent>
    </Card>
  );
};

export default ThemePerformanceChart;


