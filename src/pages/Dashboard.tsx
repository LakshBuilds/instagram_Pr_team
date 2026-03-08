import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/dashboard/Header";
import StatsCards from "@/components/dashboard/StatsCards";
import ReelsTable from "@/components/dashboard/ReelsTable";
import LocationMap from "@/components/dashboard/LocationMap";
import ProgressTracker from "@/components/dashboard/ProgressTracker";
import StreakCounter from "@/components/dashboard/StreakCounter";
import AchievementsSection from "@/components/dashboard/AchievementsSection";
import WeeklySummary from "@/components/dashboard/WeeklySummary";
import { calculateStreakData } from "@/lib/streakCalculator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Save, Key, AlertCircle, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importApifyDataToSupabase, refreshAllReelsFromApify } from "@/lib/apify";
import { fetchFromInternalApi, transformInternalApiToReel, getRateLimitStatus } from "@/lib/internalApi";
import { getApiProvider } from "@/lib/apiProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUser } from "@clerk/clerk-react";

interface Reel {
  id: string;
  ownerusername: string | null;
  caption: string | null;
  likescount: number | null;
  commentscount: number | null;
  videoplaycount: number | null;
  videoviewcount?: number | null;
  videowatchcount?: number | null;
  payout: number | null;
  permalink: string | null;
  takenat: string | null;
  created_by_user_id: string | null;
  created_by_email?: string | null;
  is_archived?: boolean | null;
  language?: string | null;
  locationname: string | null;
  shortcode?: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedLanguage = searchParams.get("language") || "All";
  const selectedLocation = searchParams.get("location") || "All";
  const viewMode = searchParams.get("view") || "table";
  const { user, isLoaded } = useUser();
  const [yourReels, setYourReels] = useState<Reel[]>([]);
  const [allReels, setAllReels] = useState<Reel[]>([]);
  const [globalReels, setGlobalReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("your-reels");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingFailed, setRefreshingFailed] = useState(false);
  const [failedReelsCount, setFailedReelsCount] = useState(0);

  // Load reels once Clerk user is ready
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    const load = async () => {
      try {
        const userEmail = user.primaryEmailAddress?.emailAddress;
        console.log("Loading reels for user email:", userEmail);
        await fetchReels(userEmail || "");
        console.log("Reels loaded successfully");
      } catch (error) {
        console.error("Error loading reels:", error);
        toast.error("Failed to load reels");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoaded, user, navigate, selectedLanguage, selectedLocation]);

  // Refetch reels when language or location changes
  useEffect(() => {
    if (user) {
      const userEmail = user.primaryEmailAddress?.emailAddress;
      fetchReels(userEmail || "");
    }
  }, [selectedLanguage, selectedLocation, user]);

  // Supabase returns max 1000 rows per request; paginate to get all rows
  const PAGE_SIZE = 1000;
  const fetchAllPages = async (buildQuery: () => any): Promise<Reel[]> => {
    let from = 0;
    const all: Reel[] = [];
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) return all;
      if (!data?.length) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  };

  const fetchReels = async (userEmail: string) => {
    try {
      console.log("🔍 Fetching reels for user email:", userEmail);
      
      const buildUserQuery = () => {
        let q: any = supabase.from("reels").select("*").eq("created_by_email", userEmail);
        if (selectedLanguage !== "All") q = q.eq("language", selectedLanguage);
        if (selectedLocation !== "All") q = q.ilike("locationname", `%${selectedLocation}%`);
        return q.order("takenat", { ascending: false });
      };
      const buildTeamQuery = () => {
        let q: any = supabase.from("reels").select("*");
        if (selectedLanguage !== "All") q = q.eq("language", selectedLanguage);
        if (selectedLocation !== "All") q = q.ilike("locationname", `%${selectedLocation}%`);
        return q.order("takenat", { ascending: false });
      };
      const buildGlobalQuery = () => supabase.from("reels").select("*").order("takenat", { ascending: false });

      const [userReels, teamReels, globalReelsData] = await Promise.all([
        fetchAllPages(buildUserQuery),
        fetchAllPages(buildTeamQuery),
        fetchAllPages(buildGlobalQuery),
      ]);

      console.log("✅ User reels found:", userReels.length);
      console.log("✅ Team reels found:", teamReels.length);
      console.log("✅ Global reels found:", globalReelsData.length);
      console.log("💾 Setting state - yourReels:", userReels.length, "allReels:", teamReels.length, "globalReels:", globalReelsData.length);
      setYourReels(userReels);
      setAllReels(teamReels);
      setGlobalReels(globalReelsData);
      
      // Fetch failed reels count
      const countQuery = supabase
        .from("reels")
        .select("*", { count: "exact", head: true });
      const { count } = await (countQuery as any).eq("refresh_failed", true);
      setFailedReelsCount(count || 0);
    } catch (error) {
      console.error("fetchReels error:", error);
      throw error;
    }
  };

  const getReelViews = (reel: Reel): number => {
    // For totals, use ONLY videoplaycount so it matches:
    // SELECT SUM(videoplaycount) FROM public.reels;
    return Number(reel.videoplaycount) || 0;
  };

  const calculateStats = (reels: Reel[]) => {
    // Deduplicate reels by shortcode — keep the entry with the highest view count
    const bestByKey = new Map<string, Reel>();
    for (const reel of reels) {
      const key = reel.shortcode || reel.id;
      const existing = bestByKey.get(key);
      if (!existing || getReelViews(reel) > getReelViews(existing)) {
        bestByKey.set(key, reel);
      }
    }
    const uniqueReels = Array.from(bestByKey.values());
    
    return {
      totalReels: uniqueReels.length,
      totalLikes: uniqueReels.reduce((sum, reel) => sum + (Number(reel.likescount) || 0), 0),
      totalComments: uniqueReels.reduce((sum, reel) => {
        const comments = typeof reel.commentscount === 'string' 
          ? parseInt(reel.commentscount || '0', 10) 
          : (Number(reel.commentscount) || 0);
        return sum + comments;
      }, 0),
      totalViews: uniqueReels.reduce((sum, reel) => sum + getReelViews(reel), 0),
      totalPayout: uniqueReels.reduce((sum, reel) => sum + (parseFloat(String(reel.payout)) || 0), 0),
    };
  };

  const handleSaveApiKey = async () => {
    // With Clerk integration and no profiles table, we only store API key in memory for now
    toast.success("API key set for this session");
  };

  const handleImportFromApify = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setImporting(true);
    try {
      // Use custom API key if provided, otherwise undefined will use default
      const keyToUse = apiKey.trim() || undefined;
      
      const userInfo = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        fullName: user.fullName || "User",
      };
      const result = await importApifyDataToSupabase(userInfo, keyToUse);
      
      if (result.errors === 0) {
        toast.success(`Successfully imported ${result.success} reel(s) from Apify`);
      } else if (result.success > 0) {
        toast.warning(`Imported ${result.success} reel(s), ${result.errors} error(s)`);
      } else {
        toast.error(`Failed to import: ${result.errors} error(s)`);
      }

      // Refresh the reels after import
      const userEmail = user.primaryEmailAddress?.emailAddress;
      await fetchReels(userEmail || "");
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import data from Apify. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const refreshReelsFromInternalApi = async (userInfo: { id: string; email: string; fullName: string }) => {
    // Fetch all existing reels
    const { data: existingReels, error } = await supabase
      .from("reels")
      .select("*")
      .or(`permalink.not.is.null,url.not.is.null,inputurl.not.is.null`);

    if (error || !existingReels) {
      console.error("Error fetching reels:", error);
      return { total: 0, success: 0, errors: 1 };
    }

    console.log(`🔄 Refreshing ${existingReels.length} reels from Internal API...`);
    
    const results = { total: existingReels.length, success: 0, errors: 0 };
    
    // Process each reel (server handles rate limiting)
    for (const reel of existingReels) {
      const url = reel.permalink || reel.url || reel.inputurl;
      if (!url) continue;
      
      try {
        const response = await fetchFromInternalApi(url); // Direct call - server handles rate limiting
        const transformed = transformInternalApiToReel(response, url);
        
        // Build update object with all available fields
        const updateData: any = {
          videoplaycount: transformed.videoplaycount,
          likescount: transformed.likescount,
          commentscount: transformed.commentscount,
          lastupdatedat: new Date().toISOString(),
          refresh_failed: false, // Mark as successful
        };
        
        // Add takenat (date of posting) if available and not already set
        if (transformed.takenat && !reel.takenat) {
          updateData.takenat = transformed.takenat;
        }
        
        // Update the reel in database
        const { error: updateError } = await supabase
          .from("reels")
          .update(updateData)
          .eq("id", reel.id);
        
        if (updateError) {
          console.error(`Error updating reel ${reel.id}:`, updateError);
          // Mark as failed
          await supabase.from("reels").update({ refresh_failed: true } as any).eq("id", reel.id);
          results.errors++;
        } else {
          results.success++;
          console.log(`✅ Updated reel ${reel.shortcode}`);
        }
      } catch (error) {
        console.error(`Error refreshing reel ${url}:`, error);
        // Mark as failed
        await supabase.from("reels").update({ refresh_failed: true } as any).eq("id", reel.id);
        results.errors++;
      }
    }
    
    return results;
  };

  const handleRefreshData = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setRefreshing(true);
    try {
      const keyToUse = apiKey.trim() || undefined;
      const provider = getApiProvider();
      
      const userInfo = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        fullName: user.fullName || "User",
      };
      
      let result;
      
      if (provider === 'internal') {
        // Refresh using internal API (server handles rate limiting)
        toast.info("Refreshing reels using Internal API...");
        result = await refreshReelsFromInternalApi(userInfo);
      } else {
        result = await refreshAllReelsFromApify(userInfo, keyToUse);
      }
      
      if (result.total === 0) {
        toast.info("No reels found to refresh");
      } else if (result.errors === 0) {
        toast.success(`Successfully refreshed ${result.success} reel(s) from Apify`);
      } else if (result.success > 0) {
        toast.warning(`Refreshed ${result.success} reel(s), ${result.errors} error(s) out of ${result.total} total`);
      } else {
        toast.error(`Failed to refresh: ${result.errors} error(s) out of ${result.total} total`);
      }

      // Refresh the reels list after updating
      const userEmail = user.primaryEmailAddress?.emailAddress;
      await fetchReels(userEmail || "");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh data from Apify. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshFailedReels = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setRefreshingFailed(true);
    try {
      const keyToUse = apiKey.trim() || undefined;
      const provider = getApiProvider();
      
      const userInfo = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        fullName: user.fullName || "User",
      };
      
      // Fetch only failed reels
      const failedQuery = supabase
        .from("reels")
        .select("*");
      const { data: failedReels, error: fetchError } = await (failedQuery as any)
        .eq("refresh_failed", true)
        .or(`permalink.not.is.null,url.not.is.null,inputurl.not.is.null`);
      
      if (fetchError || !failedReels || failedReels.length === 0) {
        toast.info("No failed reels to refresh");
        setRefreshingFailed(false);
        return;
      }

      toast.info(`Refreshing ${failedReels.length} failed reel(s) using ${provider === 'internal' ? 'Internal API' : 'External API'}...`);
      
      const results = { total: failedReels.length, success: 0, errors: 0 };
      
      for (const reel of failedReels) {
        const url = reel.permalink || reel.url || reel.inputurl;
        if (!url) continue;
        
        try {
          if (provider === 'internal') {
            const response = await fetchFromInternalApi(url);
            const transformed = transformInternalApiToReel(response, url);
            
            const { error: updateError } = await supabase
              .from("reels")
              .update({
                videoplaycount: transformed.videoplaycount,
                likescount: transformed.likescount,
                commentscount: transformed.commentscount,
                lastupdatedat: new Date().toISOString(),
                refresh_failed: false,
              } as any)
              .eq("id", reel.id);
            
            if (updateError) {
              results.errors++;
            } else {
              results.success++;
            }
          } else {
            // Use Apify for external API
            const result = await refreshAllReelsFromApify(userInfo, keyToUse);
            results.success += result.success;
            results.errors += result.errors;
            break; // Apify handles all at once
          }
        } catch (error) {
          console.error(`Error refreshing failed reel ${url}:`, error);
          results.errors++;
        }
      }
      
      if (results.errors === 0 && results.success > 0) {
        toast.success(`Successfully refreshed ${results.success} previously failed reel(s)`);
      } else if (results.success > 0) {
        toast.warning(`Refreshed ${results.success} reel(s), ${results.errors} still failing`);
      } else {
        toast.error(`Failed to refresh: ${results.errors} error(s)`);
      }

      // Refresh the reels list after updating
      const userEmail = user.primaryEmailAddress?.emailAddress;
      await fetchReels(userEmail || "");
    } catch (error) {
      console.error("Refresh failed reels error:", error);
      toast.error("Failed to refresh failed reels. Please try again.");
    } finally {
      setRefreshingFailed(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const yourStats = calculateStats(yourReels);
  const allStats = calculateStats(allReels);
  const globalStats = calculateStats(globalReels.length > 0 ? globalReels : allReels);
  
  // Calculate streak data for the current user
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const userStreakData = calculateStreakData(yourReels, userEmail);
  const teamStreakData = calculateStreakData(allReels);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-instagram bg-clip-text text-transparent">
            Creator Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your Instagram content performance
            {selectedLanguage !== "All" && (
              <span className="ml-2 text-primary font-medium">
                • Language: {selectedLanguage}
              </span>
            )}
          </p>
        </div>
        <Tabs defaultValue="your-reels" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="your-reels" className="flex items-center gap-2">
                Your Reels
                <StreakCounter 
                  streak={userStreakData.currentStreak} 
                  isActiveToday={userStreakData.isActiveToday} 
                  size="sm" 
                />
              </TabsTrigger>
              <TabsTrigger value="team-reels" className="flex items-center gap-2">
                Team Reels
                <StreakCounter 
                  streak={teamStreakData.currentStreak} 
                  isActiveToday={teamStreakData.isActiveToday} 
                  size="sm" 
                />
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="your-reels" className="space-y-6">
            <ProgressTracker 
              yourViews={yourStats.totalViews} 
              teamViews={globalStats.totalViews} 
              variant="your-reels" 
            />
            <AchievementsSection reels={yourReels} userEmail={userEmail} />
            <StatsCards {...yourStats} />
            {viewMode === "map" ? (
              <LocationMap 
                reels={yourReels} 
                selectedLanguage={selectedLanguage === "All" ? null : selectedLanguage}
                selectedLocation={selectedLocation === "All" ? null : selectedLocation}
              />
            ) : (
              <ReelsTable reels={yourReels} onUpdate={() => {
                const userEmail = user?.primaryEmailAddress?.emailAddress;
                fetchReels(userEmail || "");
              }} />
            )}
          </TabsContent>

          <TabsContent value="team-reels" className="space-y-6">
            <ProgressTracker 
              yourViews={yourStats.totalViews} 
              teamViews={globalStats.totalViews} 
              variant="team-reels" 
            />
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex items-center gap-2">
                <Button
                  onClick={handleRefreshData}
                  disabled={refreshing || refreshingFailed}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Refresh All
                    </>
                  )}
                </Button>
                {failedReelsCount > 0 && (
                  <Button
                    onClick={handleRefreshFailedReels}
                    disabled={refreshing || refreshingFailed}
                    variant="outline"
                    size="sm"
                    className="h-8 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20"
                  >
                    {refreshingFailed ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-2" />
                        Retry Failed ({failedReelsCount})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Token Key
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key-team">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="api-key-team"
                      type="password"
                      placeholder="Enter your Apify API token"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={savingApiKey}
                      variant="outline"
                    >
                      {savingApiKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {apiKey ? "Using your custom API key" : "Using default API key from environment"}
                  </p>
                </div>
                
                <div className="pt-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-700 dark:text-red-300">
                          <span className="font-semibold">Important:</span> This is a free API that fetches Instagram data. The API token may expire periodically. Click here to learn how to get your own API token.
                        </p>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>How to Get Your Apify API Token</DialogTitle>
                        <DialogDescription>
                          Follow these steps to obtain your free Apify API token
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                          <p className="text-blue-900 dark:text-blue-100">
                            <strong>Note:</strong> This is a free API service that fetches Instagram reel data. However, the API token may expire from time to time. To ensure uninterrupted access, you can get your own free API token by following the steps below.
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                              1
                            </div>
                            <div className="flex-1">
                              <p className="font-medium mb-1">Visit the Apify Console</p>
                              <p className="text-muted-foreground mb-2">
                                Go to the following link and register/login to your Apify account:
                              </p>
                              <a
                                href="https://console.apify.com/actors/shu8hvrXbJbY3Eb9W/runs/Cv6NRD7kIDtDNZHf2#output"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                Open Apify Console
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                              2
                            </div>
                            <div className="flex-1">
                              <p className="font-medium mb-1">Click on the "API" Button</p>
                              <p className="text-muted-foreground">
                                Once you're logged in, look for the <strong>"API"</strong> button in the top navigation bar and click on it.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                              3
                            </div>
                            <div className="flex-1">
                              <p className="font-medium mb-1">Copy Your API Token</p>
                              <p className="text-muted-foreground mb-2">
                                In the API section, you'll see an "API token" dropdown field. Click on the copy button (two overlapping rectangles icon) next to the token field to copy your API token.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                              4
                            </div>
                            <div className="flex-1">
                              <p className="font-medium mb-1">Paste and Save</p>
                              <p className="text-muted-foreground">
                                Paste the copied API token into the "API Key" field above and click the <strong>"Save"</strong> button to store it.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                          <p className="text-yellow-900 dark:text-yellow-100 text-xs">
                            <strong>Tip:</strong> If you don't have an Apify account, you can create one for free. The default API key will work initially, but getting your own token ensures better reliability.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <WeeklySummary
              totalViews={globalStats.totalViews}
              totalReels={globalStats.totalReels}
              totalLikes={globalStats.totalLikes}
              totalComments={globalStats.totalComments}
              totalPayout={globalStats.totalPayout}
            />
            <StatsCards {...allStats} />
            {viewMode === "map" ? (
              <LocationMap 
                reels={allReels} 
                selectedLanguage={selectedLanguage === "All" ? null : selectedLanguage}
                selectedLocation={selectedLocation === "All" ? null : selectedLocation}
              />
            ) : (
              <ReelsTable reels={allReels} onUpdate={() => {
                const userEmail = user?.primaryEmailAddress?.emailAddress;
                fetchReels(userEmail || "");
              }} />
            )}
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
