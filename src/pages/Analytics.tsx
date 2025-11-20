import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import Header from "@/components/dashboard/Header";
import DateRangeFilter from "@/components/analytics/DateRangeFilter";
import TrendChart from "@/components/analytics/TrendChart";
import PerformanceMetrics from "@/components/analytics/PerformanceMetrics";
import TopPerformers from "@/components/analytics/TopPerformers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Eye, DollarSign, Video } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string;
}

interface Reel {
  id: string;
  ownerusername: string | null;
  caption: string | null;
  likescount: number | null;
  commentscount: number | null;
  videoviewcount: number | null;
  payout: number | null;
  permalink: string | null;
  takenat: string | null;
  created_by_user_id: string | null;
}

const Analytics = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchProfile(session.user.id);
      await fetchReels(session.user.id);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
        fetchReels(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const fetchReels = async (userId: string) => {
    const { data } = await supabase
      .from("reels")
      .select("*")
      .order("takenat", { ascending: false });

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
  const userReels = filteredReels.filter(r => r.created_by_user_id === user?.id);

  const prepareChartData = (reels: Reel[]) => {
    const dataMap = new Map<string, { likes: number; views: number; payout: number; count: number }>();

    reels.forEach((reel) => {
      if (!reel.takenat) return;
      const date = format(new Date(reel.takenat), "MMM dd");
      const existing = dataMap.get(date) || { likes: 0, views: 0, payout: 0, count: 0 };
      
      dataMap.set(date, {
        likes: existing.likes + (reel.likescount || 0),
        views: existing.views + (reel.videoviewcount || 0),
        payout: existing.payout + (parseFloat(String(reel.payout)) || 0),
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
      views: current.reduce((sum, r) => sum + (r.videoviewcount || 0), 0),
      payout: current.reduce((sum, r) => sum + (parseFloat(String(r.payout)) || 0), 0),
      reels: current.length,
    };

    const previousStats = {
      likes: previous.reduce((sum, r) => sum + (r.likescount || 0), 0),
      views: previous.reduce((sum, r) => sum + (r.videoviewcount || 0), 0),
      payout: previous.reduce((sum, r) => sum + (parseFloat(String(r.payout)) || 0), 0),
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
        title: "Total Payout",
        value: `$${currentStats.payout.toFixed(2)}`,
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

  return (
    <div className="min-h-screen bg-background">
      <Header
        userEmail={profile?.email || user?.email || ""}
        userName={profile?.full_name || "User"}
      />
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
            <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>

          <Tabs defaultValue="team" className="space-y-6">
            <TabsList>
              <TabsTrigger value="team">Team Analytics</TabsTrigger>
              <TabsTrigger value="personal">Your Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="space-y-6">
              <PerformanceMetrics metrics={metrics} />
              
              <TrendChart
                data={chartData}
                title="Engagement Trends"
                description="Likes and views over time"
                dataKeys={[
                  { key: "likes", name: "Likes", color: "hsl(var(--chart-2))" },
                  { key: "views", name: "Views", color: "hsl(var(--chart-4))" },
                ]}
              />

              <TrendChart
                data={chartData}
                title="Revenue Trends"
                description="Payout trends over time"
                dataKeys={[
                  { key: "payout", name: "Payout ($)", color: "hsl(var(--chart-5))" },
                ]}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TopPerformers reels={filteredReels} title="Top by Likes" metric="likes" />
                <TopPerformers reels={filteredReels} title="Top by Views" metric="views" />
                <TopPerformers reels={filteredReels} title="Top by Payout" metric="payout" />
              </div>
            </TabsContent>

            <TabsContent value="personal" className="space-y-6">
              <PerformanceMetrics 
                metrics={calculateMetrics(
                  userReels,
                  getPreviousPeriodReels().filter(r => r.created_by_user_id === user?.id)
                )} 
              />
              
              <TrendChart
                data={prepareChartData(userReels)}
                title="Your Engagement Trends"
                description="Your likes and views over time"
                dataKeys={[
                  { key: "likes", name: "Likes", color: "hsl(var(--chart-2))" },
                  { key: "views", name: "Views", color: "hsl(var(--chart-4))" },
                ]}
              />

              <TrendChart
                data={prepareChartData(userReels)}
                title="Your Revenue Trends"
                description="Your payout trends over time"
                dataKeys={[
                  { key: "payout", name: "Payout ($)", color: "hsl(var(--chart-5))" },
                ]}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TopPerformers reels={userReels} title="Your Top by Likes" metric="likes" />
                <TopPerformers reels={userReels} title="Your Top by Views" metric="views" />
                <TopPerformers reels={userReels} title="Your Top by Payout" metric="payout" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
