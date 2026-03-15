import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, Link as LinkIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";

const API_BASE = "https://youtube-scrapper-api.onrender.com";

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchVideoData(url: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/video?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || json || null;
  } catch {
    return null;
  }
}

function parseDurationToSeconds(duration: string | undefined | null): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    const parts = duration.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }
  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

const ImportVideo = () => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [singleVideoUrl, setSingleVideoUrl] = useState("");
  const [importingSingle, setImportingSingle] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [importingBulk, setImportingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { navigate("/auth"); return; }
    setLoading(false);
  }, [isLoaded, user, navigate]);

  const saveVideo = async (videoId: string, url: string, apiData: Record<string, any> | null) => {
    if (!user) throw new Error("Not authenticated");

    const { data: existing } = await supabase
      .from("videos")
      .select("id")
      .eq("video_id", videoId)
      .maybeSingle();

    if (existing) {
      toast.info(`Video ${videoId} already exists`);
      return false;
    }

    const userInfo = {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || "",
      fullName: user.fullName || "User",
    };

    const record: Record<string, any> = {
      video_id: videoId,
      video_url: url,
      created_by_user_id: userInfo.id,
      created_by_email: userInfo.email,
      created_by_name: userInfo.fullName,
      is_short: apiData?.isShort ?? url.includes("/shorts/"),
    };

    if (apiData) {
      const snippet = apiData.snippet || {};
      const stats = apiData.statistics || {};
      const content = apiData.contentDetails || {};
      const channel = apiData.channel || {};
      const thumbs = snippet.thumbnails || {};

      record.title = snippet.title || apiData.title || null;
      record.description = snippet.description || apiData.description || null;
      record.channel_name = snippet.channelTitle || channel.title || null;
      record.channel_id = snippet.channelId || channel.id || null;
      record.thumbnail_url = thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || null;
      record.view_count = Number(stats.viewCount) || null;
      record.like_count = Number(stats.likeCount) || null;
      record.comment_count = Number(stats.commentCount) || null;
      record.subscriber_count = Number(channel.subscriberCount) || null;
      record.duration_seconds = content.durationSeconds || parseDurationToSeconds(content.duration) || null;
      record.published_at = snippet.publishedAt || null;
      record.category = snippet.categoryId || null;
      record.tags = snippet.tags?.length ? snippet.tags : null;
    } else {
      record.title = `YouTube Video ${videoId}`;
    }

    const { error } = await supabase.from("videos").insert(record);
    if (error) throw error;
    return true;
  };

  const handleImportSingle = async () => {
    if (!user) { toast.error("Not authenticated"); return; }
    const url = singleVideoUrl.trim();
    if (!url) { toast.error("Please enter a video URL"); return; }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) { toast.error("Invalid YouTube URL"); return; }

    setImportingSingle(true);
    try {
      toast.info("Fetching video data from API...");
      const apiData = await fetchVideoData(url);
      if (!apiData) toast.warning("API unavailable — saving with URL only");

      const saved = await saveVideo(videoId, url, apiData);
      if (saved) {
        toast.success(apiData ? `Imported: ${apiData.title || videoId}` : "Video imported (metadata pending)");
        setSingleVideoUrl("");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setImportingSingle(false);
    }
  };

  const handleImportBulk = async () => {
    if (!user) { toast.error("Not authenticated"); return; }
    const urls = bulkUrls.split("\n").map((u) => u.trim()).filter((u) => u.length > 0);
    if (urls.length === 0) { toast.error("Enter at least one URL"); return; }

    setImportingBulk(true);
    setBulkProgress({ current: 0, total: urls.length });
    let success = 0, errors = 0;

    for (let i = 0; i < urls.length; i++) {
      setBulkProgress({ current: i + 1, total: urls.length });
      const url = urls[i];
      try {
        const videoId = extractYouTubeVideoId(url);
        if (!videoId) { errors++; continue; }
        const apiData = await fetchVideoData(url);
        const saved = await saveVideo(videoId, url, apiData);
        if (saved) success++;
      } catch {
        errors++;
      }
    }

    if (errors === 0 && success > 0) {
      toast.success(`Successfully imported ${success} video(s)!`);
      setBulkUrls("");
    } else if (success > 0) {
      toast.warning(`Imported ${success}, failed ${errors}`);
    } else {
      toast.error("Failed to import videos");
    }

    setImportingBulk(false);
    setBulkProgress({ current: 0, total: 0 });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-youtube bg-clip-text text-transparent">Import Videos</h1>
          <p className="text-muted-foreground mt-1">Import YouTube videos — metadata is fetched automatically via API</p>
        </div>

        <Tabs defaultValue="single" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single"><LinkIcon className="h-4 w-4 mr-2" />Single Video</TabsTrigger>
            <TabsTrigger value="bulk"><FileText className="h-4 w-4 mr-2" />Bulk Import</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import Single Video</CardTitle>
                <CardDescription>Enter a YouTube video or Shorts URL — title, views, likes, channel info will be fetched automatically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="single-url">Video URL</Label>
                  <Input
                    id="single-url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    value={singleVideoUrl}
                    onChange={(e) => setSingleVideoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleImportSingle()}
                  />
                </div>
                <Button onClick={handleImportSingle} disabled={importingSingle || !singleVideoUrl.trim()} className="bg-gradient-youtube w-full" size="lg">
                  {importingSingle ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Fetching & Importing...</>) : (<><Upload className="h-4 w-4 mr-2" />Import Video</>)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Import Videos</CardTitle>
                <CardDescription>Enter multiple YouTube URLs, one per line — each will be fetched from the API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-urls">Video URLs (one per line)</Label>
                  <Textarea
                    id="bulk-urls"
                    placeholder={`https://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://youtube.com/shorts/abc123\nhttps://youtu.be/xyz789`}
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">{bulkUrls.split("\n").filter((l) => l.trim()).length} URL(s) entered</p>
                </div>
                {importingBulk && bulkProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-youtube transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">{bulkProgress.current} / {bulkProgress.total} videos processed</p>
                  </div>
                )}
                <Button onClick={handleImportBulk} disabled={importingBulk || !bulkUrls.trim()} className="bg-gradient-youtube w-full" size="lg">
                  {importingBulk ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing {bulkProgress.current}/{bulkProgress.total}...</>) : (<><Upload className="h-4 w-4 mr-2" />Import All Videos</>)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ImportVideo;
