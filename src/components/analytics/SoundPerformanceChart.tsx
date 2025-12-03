import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Music } from "lucide-react";

interface Reel {
  original_sound_info?: any;
  music_info?: any;
  videoplaycount: number | null;
  likescount: number | null;
  commentscount: number | null;
}

interface SoundPerformanceChartProps {
  reels: Reel[];
  title?: string;
  description?: string;
}

const SoundPerformanceChart = ({ 
  reels, 
  title = "Sound / Artist Performance",
  description = "Top performing sounds and artists"
}: SoundPerformanceChartProps) => {
  const soundStats: { [key: string]: { views: number; likes: number; comments: number; count: number; artist?: string } } = {};
  
  reels
    .filter(reel => reel.original_sound_info || reel.music_info)
    .forEach(reel => {
      const soundInfo = reel.original_sound_info || reel.music_info;
      let soundKey = "Unknown Sound";
      
      if (soundInfo) {
        if (soundInfo.ig_artist?.username) {
          soundKey = soundInfo.ig_artist.username;
        } else if (soundInfo.ig_artist?.full_name) {
          soundKey = soundInfo.ig_artist.full_name;
        } else if (soundInfo.title) {
          soundKey = soundInfo.title;
        }
      }
      
      if (!soundStats[soundKey]) {
        soundStats[soundKey] = { 
          views: 0, 
          likes: 0, 
          comments: 0, 
          count: 0,
          artist: soundInfo?.ig_artist?.full_name || soundInfo?.ig_artist?.username || ""
        };
      }
      
      soundStats[soundKey].views += reel.videoplaycount || 0;
      soundStats[soundKey].likes += reel.likescount || 0;
      soundStats[soundKey].comments += reel.commentscount || 0;
      soundStats[soundKey].count += 1;
    });

  const data = Object.entries(soundStats)
    .filter(([_, stats]) => stats.count >= 1)
    .map(([sound, stats]) => ({
      sound: sound.length > 20 ? sound.substring(0, 20) + "..." : sound,
      avgViews: Math.round(stats.views / stats.count),
      avgLikes: Math.round(stats.likes / stats.count),
      avgComments: Math.round(stats.comments / stats.count),
      count: stats.count,
      artist: stats.artist,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 10); // Top 10 sounds

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Music className="h-12 w-12 mb-4 opacity-50" />
            <p>No sound/artist data available</p>
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
              dataKey="sound" 
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
                      <p className="font-semibold">{data.sound}</p>
                      {data.artist && <p className="text-sm text-muted-foreground">Artist: {data.artist}</p>}
                      <p className="text-sm">Avg Views: {data.avgViews.toLocaleString()}</p>
                      <p className="text-sm">Avg Likes: {data.avgLikes.toLocaleString()}</p>
                      <p className="text-sm">Used in {data.count} reel(s)</p>
                    </div>
                  );
                }
                return null;
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

export default SoundPerformanceChart;


