import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { smartBatchRefresh, getRefreshRecommendation, RefreshResult } from "@/lib/smartRefresh";
import { getReelsForRefresh, ReelForRefresh } from "@/lib/viewsHistory";

interface SmartRefreshPanelProps {
  totalReels: number;
  userEmail?: string;
  lastRefreshTime?: Date;
  onRefreshComplete?: () => void;
}

const SmartRefreshPanel = ({ 
  totalReels, 
  userEmail, 
  lastRefreshTime,
  onRefreshComplete 
}: SmartRefreshPanelProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentReel, setCurrentReel] = useState<string>("");
  const [results, setResults] = useState<RefreshResult[]>([]);
  const [reelsToRefresh, setReelsToRefresh] = useState<ReelForRefresh[]>([]);

  const recommendation = getRefreshRecommendation(totalReels, lastRefreshTime);

  const loadReelsForRefresh = async () => {
    const reels = await getReelsForRefresh(recommendation.recommendedCount, userEmail);
    setReelsToRefresh(reels);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setProgress(0);
    setResults([]);

    const result = await smartBatchRefresh(
      recommendation.recommendedCount,
      userEmail,
      (current, total, refreshResult) => {
        setProgress((current / total) * 100);
        setCurrentReel(refreshResult.shortcode);
        setResults(prev => [...prev, refreshResult]);
      }
    );

    setIsRefreshing(false);
    
    if (onRefreshComplete) {
      onRefreshComplete();
    }
  };

  const successCount = results.filter(r => r.success).length;
  const totalViewsGrowth = results.reduce((sum, r) => sum + r.viewsGrowth, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Smart Refresh
        </CardTitle>
        <CardDescription>
          Automatically refresh reels based on decay priority - newer reels get updated more frequently
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{recommendation.reason}</span>
          </div>
          <Badge variant={recommendation.shouldRefresh ? "default" : "secondary"}>
            {recommendation.recommendedCount} reels
          </Badge>
        </div>

        {isRefreshing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Refreshing: {currentReel}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {results.length > 0 && !isRefreshing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Refresh Complete</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600">
                  {successCount} successful
                </Badge>
                {results.length - successCount > 0 && (
                  <Badge variant="outline" className="text-red-600">
                    {results.length - successCount} failed
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Total views growth: +{totalViewsGrowth.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing || !recommendation.shouldRefresh}
            className="flex-1"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Smart Refresh ({recommendation.recommendedCount} reels)
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Decay Priority: New reels (0-7 days) = 100, Old reels (90+ days) = 10
          </p>
          <p className="flex items-center gap-1 mt-1">
            <RefreshCw className="h-3 w-3" />
            Single reel refresh is always available from the reels table
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SmartRefreshPanel;