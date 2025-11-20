import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Header from "@/components/dashboard/Header";
import StatsCards from "@/components/dashboard/StatsCards";
import ReelsTable from "@/components/dashboard/ReelsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [yourReels, setYourReels] = useState<Reel[]>([]);
  const [allReels, setAllReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

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
    // Fetch user's own reels
    const { data: userReels } = await supabase
      .from("reels")
      .select("*")
      .eq("created_by_user_id", userId)
      .order("takenat", { ascending: false });

    // Fetch all team reels
    const { data: teamReels } = await supabase
      .from("reels")
      .select("*")
      .order("takenat", { ascending: false });

    setYourReels(userReels || []);
    setAllReels(teamReels || []);
  };

  const calculateStats = (reels: Reel[]) => {
    return {
      totalReels: reels.length,
      totalLikes: reels.reduce((sum, reel) => sum + (reel.likescount || 0), 0),
      totalComments: reels.reduce((sum, reel) => sum + (reel.commentscount || 0), 0),
      totalViews: reels.reduce((sum, reel) => sum + (reel.videoviewcount || 0), 0),
      totalPayout: reels.reduce((sum, reel) => sum + (parseFloat(String(reel.payout)) || 0), 0),
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const yourStats = calculateStats(yourReels);
  const allStats = calculateStats(allReels);

  return (
    <div className="min-h-screen bg-background">
      <Header
        userEmail={profile?.email || user?.email || ""}
        userName={profile?.full_name || "User"}
      />
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="your-reels" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="your-reels">Your Reels</TabsTrigger>
            <TabsTrigger value="team-reels">Team Reels</TabsTrigger>
          </TabsList>

          <TabsContent value="your-reels" className="space-y-6">
            <StatsCards {...yourStats} />
            <ReelsTable reels={yourReels} onUpdate={() => fetchReels(user!.id)} />
          </TabsContent>

          <TabsContent value="team-reels" className="space-y-6">
            <StatsCards {...allStats} />
            <ReelsTable reels={allReels} onUpdate={() => fetchReels(user!.id)} />
          </TabsContent>
        </Tabs>

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>Powered by buyhatke</p>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
