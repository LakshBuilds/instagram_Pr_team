import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Video } from "@/lib/types";

interface TopPerformersProps {
  videos: Video[];
  title: string;
  metric: "likes" | "views" | "payout";
}

const TopPerformers = ({ videos, title, metric }: TopPerformersProps) => {
  const sorted = [...videos]
    .sort((a, b) => {
      const val = (v: Video) =>
        metric === "likes" ? (v.like_count ?? 0)
        : metric === "views" ? (v.view_count ?? 0)
        : (Number(v.payout) || 0);
      return val(b) - val(a);
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Best performing content in selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sorted.map((video, index) => {
            const value =
              metric === "likes" ? (video.like_count ?? 0)
              : metric === "views" ? (video.view_count ?? 0)
              : (Number(video.payout) || 0);

            return (
              <div key={video.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Badge variant="secondary" className="shrink-0">#{index + 1}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">@{video.channel_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">{video.title || "No title"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">
                    {metric === "payout" ? `₹${value.toFixed(2)}` : value.toLocaleString()}
                  </span>
                  {video.video_url && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(video.video_url!, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopPerformers;
