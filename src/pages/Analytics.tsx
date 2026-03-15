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
import PostingTimeHeatmap from "@/components/analytics/PostingTimeHeatmap";
import CreatorComparisonChart from "@/components/analytics/CreatorComparisonChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Eye, DollarSign, Video, MessageSquare } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import type { Video as VideoType } from "@/lib/types";

const Analytics = () => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const userEmail = user?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { navigate("/auth"); return; }
    const load = async () => {
      await fetchVideos();
      setLoading(false);
    };
    load();
  }, [isLoaded, user, navigate]);

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) console.error("Error fetching videos:", error);
    setVideos((data as VideoType[]) || []);
  };

  const filterByRange = (vids: VideoType[]) => {
    if (!dateRange?.from) return vids;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
    return vids.filter((v) => v.published_at && isWithinInterval(new Date(v.published_at), { start: from, end: to }));
  };

  const filtered = filterByRange(videos);
  const userVideos = filtered.filter((v) => v.created_by_email === userEmail);

  const prepareChartData = (vids: VideoType[]) => {
    const map = new Map<string, { likes: number; views: number; comments: number; payout: number; count: number }>();
    vids.forEach((v) => {
      if (!v.published_at) return;
      const date = format(new Date(v.published_at), "MMM dd");
      const prev = map.get(date) || { likes: 0, views: 0, comments: 0, payout: 0, count: 0 };
      map.set(date, {
        likes: prev.likes + (v.like_count || 0),
        views: prev.views + (v.view_count || 0),
        comments: prev.comments + (v.comment_count || 0),
        payout: prev.payout + (Number(v.payout) || 0),
        count: prev.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const calculateMetrics = (current: VideoType[], previous: VideoType[]) => {
    const calc = (arr: VideoType[]) => ({
      likes: arr.reduce((s, v) => s + (v.like_count || 0), 0),
      views: arr.reduce((s, v) => s + (v.view_count || 0), 0),
      comments: arr.reduce((s, v) => s + (v.comment_count || 0), 0),
      payout: arr.reduce((s, v) => s + (Number(v.payout) || 0), 0),
      videos: arr.length,
    });
    const cur = calc(current);
    const prev = calc(previous);
    const change = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);
    return [
      { title: "Total Likes", value: cur.likes.toLocaleString(), change: change(cur.likes, prev.likes), icon: <Heart className="h-4 w-4 text-chart-2" /> },
      { title: "Total Views", value: cur.views.toLocaleString(), change: change(cur.views, prev.views), icon: <Eye className="h-4 w-4 text-chart-4" /> },
      { title: "Total Comments", value: cur.comments.toLocaleString(), change: change(cur.comments, prev.comments), icon: <MessageSquare className="h-4 w-4 text-chart-3" /> },
      { title: "Total Payout", value: `₹${cur.payout.toFixed(2)}`, change: change(cur.payout, prev.payout), icon: <DollarSign className="h-4 w-4 text-chart-5" /> },
      { title: "Videos Posted", value: cur.videos.toString(), change: change(cur.videos, prev.videos), icon: <Video className="h-4 w-4 text-chart-1" /> },
    ];
  };

  const getPreviousPeriod = () => {
    if (!dateRange?.from) return [];
    const daysDiff = dateRange.to ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) : 30;
    const prevFrom = subDays(dateRange.from, daysDiff);
    return videos.filter((v) => v.published_at && isWithinInterval(new Date(v.published_at), { start: prevFrom, end: dateRange.from! }));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading analytics...</p></div>;
  }

  const chartData = prepareChartData(filtered);
  const previousVideos = getPreviousPeriod();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-youtube bg-clip-text text-transparent">Analytics Dashboard</h1>
              <p className="text-muted-foreground mt-1">Track your performance over time</p>
            </div>
            <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>

          <Tabs defaultValue="team" className="space-y-6">
            <TabsList>
              <TabsTrigger value="team">Team Analytics</TabsTrigger>
              <TabsTrigger value="personal">Your Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="space-y-6">
              <PerformanceMetrics metrics={calculateMetrics(filtered, previousVideos)} />
              <TrendChart data={chartData} title="Engagement Trends" description="Likes, views, and comments over time" dataKeys={[{ key: "likes", name: "Likes", color: "hsl(var(--chart-2))" }, { key: "views", name: "Views", color: "hsl(var(--chart-4))" }, { key: "comments", name: "Comments", color: "hsl(var(--chart-3))" }]} />
              <RevenueScatterChart videos={filtered} title="Revenue Trends" description="Per video views vs payout relationship" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TopPerformers videos={filtered} title="Top by Likes" metric="likes" />
                <TopPerformers videos={filtered} title="Top by Views" metric="views" />
                <TopPerformers videos={filtered} title="Top by Payout" metric="payout" />
              </div>
              <EngagementScatterChart videos={filtered} />
              <DurationPerformanceChart videos={filtered} />
              <ThemePerformanceChart videos={filtered} />
              <PostingTimeHeatmap videos={filtered} />
              <CreatorComparisonChart videos={filtered} />
            </TabsContent>

            <TabsContent value="personal" className="space-y-6">
              <PerformanceMetrics metrics={calculateMetrics(userVideos, getPreviousPeriod().filter((v) => v.created_by_email === userEmail))} />
              <TrendChart data={prepareChartData(userVideos)} title="Your Engagement Trends" description="Your likes, views, and comments over time" dataKeys={[{ key: "likes", name: "Likes", color: "hsl(var(--chart-2))" }, { key: "views", name: "Views", color: "hsl(var(--chart-4))" }, { key: "comments", name: "Comments", color: "hsl(var(--chart-3))" }]} />
              <RevenueScatterChart videos={userVideos} title="Your Revenue Trends" description="Per video views vs payout relationship" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TopPerformers videos={userVideos} title="Your Top by Likes" metric="likes" />
                <TopPerformers videos={userVideos} title="Your Top by Views" metric="views" />
                <TopPerformers videos={userVideos} title="Your Top by Payout" metric="payout" />
              </div>
              <EngagementScatterChart videos={userVideos} title="Your Engagement vs Views" />
              <DurationPerformanceChart videos={userVideos} title="Your Duration Performance" />
              <ThemePerformanceChart videos={userVideos} title="Your Theme Performance" />
              <PostingTimeHeatmap videos={userVideos} title="Your Posting Time Heatmap" />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
