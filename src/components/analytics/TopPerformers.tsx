import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Reel {
  id: string;
  ownerusername: string | null;
  caption: string | null;
  likescount: number | null;
  videoviewcount: number | null;
  payout: number | null;
  permalink: string | null;
}

interface TopPerformersProps {
  reels: Reel[];
  title: string;
  metric: "likes" | "views" | "payout";
}

const TopPerformers = ({ reels, title, metric }: TopPerformersProps) => {
  const sortedReels = [...reels]
    .sort((a, b) => {
      const aValue = metric === "likes" ? a.likescount : metric === "views" ? a.videoviewcount : a.payout;
      const bValue = metric === "likes" ? b.likescount : metric === "views" ? b.videoviewcount : b.payout;
      return (bValue || 0) - (aValue || 0);
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
          {sortedReels.map((reel, index) => {
            const value = metric === "likes" 
              ? reel.likescount 
              : metric === "views" 
                ? reel.videoviewcount 
                : reel.payout;
            
            return (
              <div key={reel.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Badge variant="secondary" className="shrink-0">
                    #{index + 1}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">@{reel.ownerusername || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {reel.caption || "No caption"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">
                    {metric === "payout" 
                      ? `$${(value || 0).toFixed(2)}` 
                      : (value || 0).toLocaleString()}
                  </span>
                  {reel.permalink && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => window.open(reel.permalink!, "_blank")}
                    >
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
