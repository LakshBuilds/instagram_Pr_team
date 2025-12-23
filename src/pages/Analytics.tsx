import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import Header from "@/components/dashboard/Header";
import DateRangeFilter from "@/components/analytics/DateRangeFilter";
import TrendChart from "@/components/analytics/TrendChart";
import PerformanceMetrics from "@/components/analytics/PerformanceMetrics";
import TopPerformers from "@/components/analytics/TopPerformers";
import EngagementScatterChart from "@/components/analytics/EngagementScatterChart";
import RevenueScatterChart from "@/components/analytics/RevenueScatterChart";
import DurationPerformanceChart from "@/components/analytics/DurationPerformanceChart";
import ThemePerformanceChart from "@/components/analytics/ThemePerformanceChart";
import TaggedUsersChart from "@/components/analytics/TaggedUsersChart";
import SoundPerformanceChart from "@/components/analytics/SoundPerformanceChart";
import PostingTimeHeatmap from "@/components/analytics/PostingTimeHeatmap";
import CreatorComparisonChart from "@/components/analytics/CreatorComparisonChart";
import ViewsGrowthChart from "@/components/analytics/ViewsGrowthChart";
import SmartRefreshPanel from "@/components/analytics/SmartRefreshPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Heart, Eye, DollarSign, Video, MessageSquare, TrendingUp } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { getViewsInRange, getTotalViewsGrowth, ViewsGrowth } from "@/lib/viewsHistory";

interface Reel {
  id: string;
  ownerusername: string | null;
  caption: string | null;
  likescount: number | null;
  commentscount: number | null;
  videoplaycount: number | null;
  videoviewcount?: number | null;
  payout: number | null;
  permalink: string | null;
  takenat: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  is_archived?: boolean | null;
  video_duration?: number | null;
  has_tagged_users?: boolean | null;
  usertags?: any;
  original_sound_info?: any;
  music_info?: any;
  decay_priority?: number | null;
  last_refresh_at?: string | null;
}

const Analytics = () => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  // Timestamp-based analytics toggle
  const [useTimestampAnalytics, setUseTimestampAnalytics] = useState(true);
  const [viewsGrowthData, setViewsGrowthData] = useState<ViewsGrowth[]>([]);
  const [timestampMetrics, setTimestampMetrics] = useState<{
    totalViewsGrowth: number;
    totalLikesGrowth: number;
    reelsCount: number;
  } | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | undefined>();

  const userEmail = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    const load = async () => {
      await fetchReels();
      if (useTimestampAnalytics && dateRange?.from) {
        await fetchViewsGrowthData();
      }
      setLoading(false);
    };
    load();
  }, [isLoaded, user, navigate]);

  // Fetch views growth data when date range or toggle changes
  useEffect(() => {
    if (useTimestampAnalytics && dateRange?.from && !loading) {
      fetchViewsGrowthData();
    }
  }, [dateRange, useTimestampAnalytics]);

  const fetchViewsGrowthData = async () => {
    if (!dateRange?.from) return;
    
    const startDate = startOfDay(dateRange.from);
    const endDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
    
    console.log("📊 Fetching timestamp-based views growth...");
    
    const [growthData, totalGrowth] = await Promise.all([
      getViewsInRange(startDate, endDate, userEmail),
      getTotalViewsGrowth(startDate, endDate, userEmail),
    ]);
    
    setViewsGrowthData(growthData);
    setTimestampMetrics(totalGrowth);
    
    console.log(`✅ Views growth: ${totalGrowth.totalViewsGrowth} views across ${totalGrowth.reelsCount} reels`);
  };

  const fetchReels = async () => {
    console.log("📊 Analytics: Fetching all reels...");
    const { data, error } = await supabase
      .from("reels")
      .select("*")
      .order("takenat", { ascending: false });

    if (error) {
      console.error("❌ Error fetching reels:", error);
    } else {
      console.log(`✅ Analytics: Fetched ${data?.length || 0} total reels`);
    }

    setReels(data || []);
  };

  const filterReelsByDateRange = (reels: Reel[]) => {
    if (!dateRange?.from) return reels;

    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());

    return reels.filter((reel) => {
      if (!reel.takenat) return false;
      const reelDate = new Date(reel.takenat);
      return isWithinInterval(reelDate, { start: from, end: to });
    });
  };

  const filteredReels = filterReelsByDateRange(reels);
  
  // Filter user's reels by email (matching Dashboard logic)
  const userReels = filteredReels.filter(r => r.created_by_email === userEmail);
  
  console.log(`📊 Analytics: ${filteredReels.length} reels in date range, ${userReels.length} are yours (${userEmail})`);

  const prepareChartData = (reels: Reel[]) => {
    const dataMap = new Map<string, { likes: number; views: number; comments: number; payout: number; count: number }>();

    reels.forEach((reel) => {
      if (!reel.takenat) return;
      const date = format(new Date(reel.takenat), "MMM dd");
      const existing = dataMap.get(date) || { likes: 0, views: 0, comments: 0, payout: 0, count: 0 };
      
      const payoutValue = typeof reel.payout === 'number' ? reel.payout : parseFloat(String(reel.payout || '0'));
      
      // Handle commentscount as potentially string (like Dashboard does)
      const comments = typeof reel.commentscount === 'string' 
        ? parseInt(reel.commentscount || '0', 10) 
        : (reel.commentscount || 0);
      
      dataMap.set(date, {
        likes: existing.likes + (reel.likescount || 0),
        views: existing.views + (reel.videoplaycount || reel.videoviewcount || 0),
        comments: existing.comments + comments,
        payout: existing.payout + payoutValue,
        count: existing.count + 1,
      });
    });

    return Array.from(dataMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const calculateMetrics = (current: Reel[], previous: Reel[]) => {
    const currentStats = {
      likes: current.reduce((sum, r) => sum + (r.likescount || 0), 0),
      views: current.reduce((sum, r) => sum + (r.videoplaycount || r.videoviewcount || 0), 0),
      comments: current.reduce((sum, r) => {
        const comments = typeof r.commentscount === 'string' 
          ? parseInt(r.commentscount || '0', 10) 
          : (r.commentscount || 0);
        return sum + comments;
      }, 0),
      payout: current.reduce((sum, r) => {
        const payoutValue = typeof r.payout === 'number' ? r.payout : parseFloat(String(r.payout || '0'));
        return sum + payoutValue;
      }, 0),
      reels: current.length,
    };

    const previousStats = {
      likes: previous.reduce((sum, r) => sum + (r.likescount || 0), 0),
      views: previous.reduce((sum, r) => sum + (r.videoplaycount || r.videoviewcount || 0), 0),
      comments: previous.reduce((sum, r) => {
        const comments = typeof r.commentscount === 'string' 
          ? parseInt(r.commentscount || '0', 10) 
          : (r.commentscount || 0);
        return sum + comments;
      }, 0),
      payout: previous.reduce((sum, r) => {
        const payoutValue = typeof r.payout === 'number' ? r.payout : parseFloat(String(r.payout || '0'));
        return sum + payoutValue;
      }, 0),
      reels: previous.length,
    };

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return [
      {
        title: "Total Likes",
        value: currentStats.likes.toLocaleString(),
        change: calculateChange(currentStats.likes, previousStats.likes),
        icon: <Heart className="h-4 w-4 text-chart-2" />,
      },
      {
        title: "Total Views",
        value: currentStats.views.toLocaleString(),
        change: calculateChange(currentStats.views, previousStats.views),
        icon: <Eye className="h-4 w-4 text-chart-4" />,
      },
      {
        title: "Total Comments",
        value: currentStats.comments.toLocaleString(),
        change: calculateChange(currentStats.comments, previousStats.comments),
        icon: <MessageSquare className="h-4 w-4 text-chart-3" />,
      },
      {
        title: "Total Payout",
        value: `₹${currentStats.payout.toFixed(2)}`,
        change: calculateChange(currentStats.payout, previousStats.payout),
        icon: <DollarSign className="h-4 w-4 text-chart-5" />,
      },
      {
        title: "Reels Posted",
        value: currentStats.reels.toString(),
        change: calculateChange(currentStats.reels, previousStats.reels),
        icon: <Video className="h-4 w-4 text-chart-1" />,
      },
    ];
  };

  // Calculate previous period for comparison
  const getPreviousPeriodReels = () => {
    if (!dateRange?.from) return [];
    
    const daysDiff = dateRange.to 
      ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    const previousFrom = subDays(dateRange.from, daysDiff);
    const previousTo = dateRange.from;

    return reels.filter((reel) => {
      if (!reel.takenat) return false;
      const reelDate = new Date(reel.takenat);
      return isWithinInterval(reelDate, { start: previousFrom, end: previousTo });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  const chartData = prepareChartData(filteredReels);
  const previousReels = getPreviousPeriodReels();
  const metrics = calculateMetrics(filteredReels, previousReels);

  // Prepare views growth chart data for timestamp-based analytics
  const prepareViewsGrowthChartData = () => {
    if (!viewsGrowthData.length) return [];
    
    // Group by date and calculate cumulative
    const sortedData = [...viewsGrowthData].sort((a, b) => 
      a.views_growth - b.views_growth
    );
    
    let cumulative = 0;
    return sortedData.map((item, index) => {
      cumulative += item.views_growth;
      return {
        date: item.shortcode.slice(0, 8),
        views_growth: item.views_growth,
        likes_growth: item.likes_growth,
        cumulative_views: cumulative,
      };
    });
  };

  // Calculate timestamp-based metrics for display
  const getTimestampBasedMetrics = () => {
    if (!timestampMetrics) return metrics;
    
    return [
      {
        title: "Views Growth",
        value: `+${timestampMetrics.totalViewsGrowth.toLocaleString()}`,
        change: 0,
        icon: <TrendingUp className="h-4 w-4 text-chart-4" />,
      },
      {
        title: "Likes Growth", 
        value: `+${timestampMetrics.totalLikesGrowth.toLocaleString()}`,
        change: 0,
        icon: <Heart className="h-4 w-4 text-chart-2" />,
      },
      ...metrics.slice(2),
    ];
  };

  const handleRefreshComplete = () => {
    setLastRefreshTime(new Date());
    fetchReels();
    if (useTimestampAnalytics) {
      fetchViewsGrowthData();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-instagram bg-clip-text text-transparent">
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Track your performance over time
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="timestamp-mode"
                  checked={useTimestampAnalytics}
                  onCheckedChange={setUseTimestampAnalytics}
                />
                <Label htmlFor="timestamp-mode" className="text-sm">
                  Timestamp-based Views
                </Label>
              </div>
              <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
            </div>
          </div>

          <Tabs defaultValue="team" className="space-y-6">
            <TabsList>
              <TabsTrigger value="team">Team Analytics</TabsTrigger>
              <TabsTrigger value="personal">Your Analytics</TabsTrigger>
              <TabsTrigger value="refresh">Smart Refresh</TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="space-y-6">
              <PerformanceMetrics metrics={useTimestampAnalytics ? getTimestampBasedMetrics() : metrics} />
              
              {useTimestampAnalytics && (
                <ViewsGrowthChart 
                  data={prepareViewsGrowthChartData()}
                  title="Views Growth (Timestamp-based)"
                  description="Track views growth based on when data was updated, not posting date"
                />
              )}
              
              <TrendChart
                data={chartData}
                title="Engagement Trends"
                description="Likes, views, and comments over time"
                dataKeys={[
                  { key: "likes", name: "Likes", color: "hsl(var(--chart-2))" },
                  { key: "views", name: "Views", color: "hsl(var(--chart-4))" },
                  { key: "comments", name: "Comments", color: "hsl(var(--chart-3))" },
                ]}
              />

              <RevenueScatterChart
                reels={filteredReels}
                title="Revenue Trends"
                description="Per video views vs payout relationship"
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TopPerformers reels={filteredReels} title="Top by Likes" metric="likes" />
                <TopPerformers reels={filteredReels} title="Top by Views" metric="views" />
                <TopPerformers reels={filteredReels} title="Top by Payout" metric="payout" />
              </div>

              <EngagementScatterChart reels={filteredReels} />
              
              <DurationPerformanceChart reels={filteredReels} />
              
              <ThemePerformanceChart reels={filteredReels} />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TaggedUsersChart reels={filteredReels} />
                <SoundPerformanceChart reels={filteredReels} />
              </div>
              
              <PostingTimeHeatmap reels={filteredReels} />
              
              <CreatorComparisonChart reels={filteredReels} />
            </TabsContent>

            <TabsContent value="personal" className="space-y-6">
              <PerformanceMetrics 
                metrics={calculateMetrics(
                  userReels,
                  getPreviousPeriodReels().filter(r => r.created_by_email === userEmail)
                )} 
              />
              
              <TrendChart
                data={prepareChartData(userReels)}
                title="Your Engagement Trends"
                description="Your likes, views, and comments over time"
                dataKeys={[
                  { key: "likes", name: "Likes", color: "hsl(var(--chart-2))" },
                  { key: "views", name: "Views", color: "hsl(var(--chart-4))" },
                  { key: "comments", name: "Comments", color: "hsl(var(--chart-3))" },
                ]}
              />

              <RevenueScatterChart
                reels={userReels}
                title="Your Revenue Trends"
                description="Per video views vs payout relationship"
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TopPerformers reels={userReels} title="Your Top by Likes" metric="likes" />
                <TopPerformers reels={userReels} title="Your Top by Views" metric="views" />
                <TopPerformers reels={userReels} title="Your Top by Payout" metric="payout" />
              </div>

              <EngagementScatterChart reels={userReels} title="Your Engagement vs Views" />
              
              <DurationPerformanceChart reels={userReels} title="Your Duration Performance" />
              
              <ThemePerformanceChart reels={userReels} title="Your Theme Performance" />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TaggedUsersChart reels={userReels} title="Your Tagged Users Impact" />
                <SoundPerformanceChart reels={userReels} title="Your Sound Performance" />
              </div>
              
              <PostingTimeHeatmap reels={userReels} title="Your Posting Time Heatmap" />
            </TabsContent>

            <TabsContent value="refresh" className="space-y-6">
              <SmartRefreshPanel
                totalReels={reels.length}
                userEmail={userEmail}
                lastRefreshTime={lastRefreshTime}
                onRefreshComplete={handleRefreshComplete}
              />
              
              {useTimestampAnalytics && (
                <ViewsGrowthChart 
                  data={prepareViewsGrowthChartData()}
                  title="Views Growth After Refresh"
                  description="See how views are growing based on your refresh updates"
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
