import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format, getHours, getDay } from "date-fns";

interface Reel {
  takenat: string | null;
  videoplaycount: number | null;
  likescount: number | null;
  commentscount: number | null;
}

interface PostingTimeHeatmapProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const PostingTimeHeatmap = ({ 
  reels, 
  title = "Posting Time Heatmap",
  description = "Best times to post based on performance"
}: PostingTimeHeatmapProps) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Initialize heatmap data
  const heatmapData: { [key: string]: { views: number; likes: number; count: number } } = {};
  
  reels
    .filter(reel => reel.takenat)
    .forEach(reel => {
      const date = new Date(reel.takenat!);
      const day = getDay(date);
      const hour = getHours(date);
      const key = `${day}-${hour}`;
      
      if (!heatmapData[key]) {
        heatmapData[key] = { views: 0, likes: 0, count: 0 };
      }
      
      heatmapData[key].views += reel.videoplaycount || 0;
      heatmapData[key].likes += reel.likescount || 0;
      heatmapData[key].count += 1;
    });

  // Calculate average performance per cell
  const getCellData = (day: number, hour: number) => {
    const key = `${day}-${hour}`;
    const data = heatmapData[key];
    if (!data || data.count === 0) return { avgViews: 0, avgLikes: 0, count: 0 };
    
    return {
      avgViews: Math.round(data.views / data.count),
      avgLikes: Math.round(data.likes / data.count),
      count: data.count,
    };
  };

  // Find max for normalization
  const maxViews = Math.max(
    ...Object.values(heatmapData).map(d => d.count > 0 ? d.views / d.count : 0)
  );

  const getIntensity = (avgViews: number) => {
    if (avgViews === 0) return 0;
    return Math.min(100, (avgViews / maxViews) * 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: '80px repeat(24, 1fr)' }}>
              <div className="text-xs text-muted-foreground font-semibold">Day/Hour</div>
              {hours.map(hour => (
                <div key={hour} className="text-xs text-muted-foreground text-center font-semibold">
                  {hour}:00
                </div>
              ))}
            </div>
            {days.map((dayName, dayIndex) => (
              <div key={dayIndex} className="grid gap-1 mb-1" style={{ gridTemplateColumns: '80px repeat(24, 1fr)' }}>
                <div className="text-xs font-semibold text-muted-foreground flex items-center">
                  {dayName}
                </div>
                {hours.map(hour => {
                  const cellData = getCellData(dayIndex, hour);
                  const intensity = getIntensity(cellData.avgViews);
                  const bgColor = intensity > 0 
                    ? `hsl(var(--chart-4) / ${Math.max(0.2, intensity / 100)})`
                    : 'hsl(var(--muted) / 0.1)';
                  
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className="aspect-square rounded border border-border flex flex-col items-center justify-center p-1 text-xs hover:scale-105 transition-transform cursor-pointer relative group"
                      style={{ backgroundColor: bgColor }}
                      title={`${dayName} ${hour}:00 - Avg Views: ${cellData.avgViews.toLocaleString()}, Posts: ${cellData.count}`}
                    >
                      <span className="font-semibold text-[10px]">
                        {cellData.avgViews > 0 ? (cellData.avgViews / 1000).toFixed(0) + 'k' : '-'}
                      </span>
                      <span className="text-[8px] text-muted-foreground">
                        {cellData.count}
                      </span>
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10 bg-card border border-border rounded-lg p-2 shadow-lg text-xs whitespace-nowrap">
                        <p className="font-semibold">{dayName} {hour}:00</p>
                        <p>Avg Views: {cellData.avgViews.toLocaleString()}</p>
                        <p>Avg Likes: {cellData.avgLikes.toLocaleString()}</p>
                        <p>Posts: {cellData.count}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-border bg-muted/10"></div>
            <span>No posts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: 'hsl(var(--chart-4) / 0.2)' }}></div>
            <span>Low performance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: 'hsl(var(--chart-4) / 0.6)' }}></div>
            <span>Medium performance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: 'hsl(var(--chart-4) / 1)' }}></div>
            <span>High performance</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostingTimeHeatmap;

