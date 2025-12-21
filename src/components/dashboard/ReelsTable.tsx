import { useState, useRef, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, ExternalLink, Pencil, Check, X, Archive, RefreshCw, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchFromInternalApi, transformInternalApiToReel } from "@/lib/internalApi";
import { getApiProvider } from "@/lib/apiProvider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Reel {
  id: string;
  ownerusername: string | null;
  caption: string | null;
  likescount: number | null;
  commentscount: number | null;
  videoplaycount: number | null;
  videoviewcount?: number | null; // Keep for database compatibility, but use videoplaycount for display
  payout: number | null;
  permalink: string | null;
  takenat: string | null;
  is_archived?: boolean | null;
  locationname?: string | null;
  language?: string | null;
  shortcode?: string | null;
  url?: string | null;
  inputurl?: string | null;
}

// Fallback languages if database fetch fails
const FALLBACK_LANGUAGES = [
  "Hinglish",
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "English",
];

interface ReelsTableProps {
  reels: Reel[];
  onUpdate: () => void;
}

const ReelsTable = ({ reels, onUpdate }: ReelsTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocationValue, setEditLocationValue] = useState<string>("");
  const [editingLanguageId, setEditingLanguageId] = useState<string | null>(null);
  const [editLanguageValue, setEditLanguageValue] = useState<string>("Hinglish");
  const [languages, setLanguages] = useState<string[]>(FALLBACK_LANGUAGES);
  
  // Queue system for refreshing reels
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const refreshQueueRef = useRef<Array<{ reel: Reel; id: string }>>([]);
  const isProcessingRef = useRef(false);

  // Fetch languages from language_locations table (with graceful fallback)
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const { data, error } = await supabase
          .from("language_locations")
          .select("language")
          .order("language");
        
        if (error) {
          // Silently use fallback - table might not exist or RLS issue
          console.log("Using fallback languages (table not available)");
          return;
        }
        
        if (data && data.length > 0) {
          // Get unique languages
          const uniqueLanguages = [...new Set(data.map(item => item.language))];
          setLanguages(uniqueLanguages);
        }
      } catch (err) {
        // Silently use fallback
        console.log("Using fallback languages");
      }
    };
    
    fetchLanguages();
  }, []);

  // Synced scroll refs for top scrollbar
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  // Sync scroll positions between top scrollbar and table
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;

    if (!topScroll || !tableScroll) return;

    // Update scroll width
    setScrollWidth(tableScroll.scrollWidth);

    const syncTopToTable = () => {
      if (tableScroll) tableScroll.scrollLeft = topScroll.scrollLeft;
    };
    const syncTableToTop = () => {
      if (topScroll) topScroll.scrollLeft = tableScroll.scrollLeft;
    };

    topScroll.addEventListener('scroll', syncTopToTable);
    tableScroll.addEventListener('scroll', syncTableToTop);

    // Update scroll width on resize
    const resizeObserver = new ResizeObserver(() => {
      setScrollWidth(tableScroll.scrollWidth);
    });
    resizeObserver.observe(tableScroll);

    return () => {
      topScroll.removeEventListener('scroll', syncTopToTable);
      tableScroll.removeEventListener('scroll', syncTableToTop);
      resizeObserver.disconnect();
    };
  }, [reels]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("reels").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete reel");
    } else {
      toast.success("Reel deleted successfully");
      onUpdate();
    }
  };

  const handleEditPayout = (id: string, currentPayout: number) => {
    setEditingId(id);
    setEditValue(currentPayout);
  };

  const handleSavePayout = async (id: string) => {
    const { error } = await supabase
      .from("reels")
      .update({ payout: editValue })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update payout");
    } else {
      toast.success("Payout updated successfully");
      setEditingId(null);
      onUpdate();
    }
  };

  const handleEditLocation = (id: string, currentLocation: string | null) => {
    setEditingLocationId(id);
    setEditLocationValue(currentLocation || "");
  };

  const handleSaveLocation = async (id: string) => {
    const { error } = await supabase
      .from("reels")
      .update({ locationname: editLocationValue || null })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update location");
    } else {
      toast.success("Location updated successfully");
      setEditingLocationId(null);
      onUpdate();
    }
  };

  const handleEditLanguage = (id: string, currentLanguage: string | null) => {
    setEditingLanguageId(id);
    setEditLanguageValue(currentLanguage || "Hinglish");
  };

  const handleSaveLanguage = async (id: string) => {
    console.log("🔧 Saving language:", { id, language: editLanguageValue });
    toast.loading("Saving language...", { id: "save-lang" });
    
    try {
      const { error, data } = await supabase
        .from("reels")
        .update({ language: editLanguageValue || "Hinglish" })
        .eq("id", id)
        .select();

      console.log("🔧 Supabase response:", { error, data });

      if (error) {
        console.error("🔧 Error details:", JSON.stringify(error, null, 2));
        toast.error(`Failed: ${error.message || error.code || 'Unknown error'}`, { id: "save-lang" });
      } else if (!data || data.length === 0) {
        console.error("🔧 No rows updated - RLS policy may be blocking");
        toast.error("Failed: No permission to update this reel", { id: "save-lang" });
      } else {
        toast.success("Language updated!", { id: "save-lang" });
        setEditingLanguageId(null);
        onUpdate();
      }
    } catch (err) {
      console.error("🔧 Exception:", err);
      toast.error("Failed to update language", { id: "save-lang" });
    }
  };

  // Process a single reel refresh (internal function)
  const processOneReel = async (reel: Reel): Promise<void> => {
    // Try all available URL sources, including constructing from shortcode
    const url = reel.permalink || reel.url || reel.inputurl || 
      (reel.shortcode ? `https://www.instagram.com/p/${reel.shortcode}/` : null);
    if (!url) {
      throw new Error("No URL available for this reel");
    }

    const provider = getApiProvider();

    if (provider === 'internal') {
      const response = await fetchFromInternalApi(url, 5);
      const transformed = transformInternalApiToReel(response, url);

      const updateData: Record<string, unknown> = {
        lastupdatedat: new Date().toISOString(),
      };

      // Use ?? (nullish coalescing) to properly handle 0 values vs undefined/null
      const viewCount = transformed.videoplaycount ?? transformed.videoviewcount ?? 0;
      const likesCount = transformed.likescount ?? 0;
      const commentsCount = transformed.commentscount ?? 0;

      // Archive if ALL metrics are 0 (reel likely deleted/unavailable on Instagram)
      const shouldArchive = viewCount === 0 && likesCount === 0 && commentsCount === 0;
      
      console.log(`📊 Reel stats: views=${viewCount}, likes=${likesCount}, comments=${commentsCount}, shouldArchive=${shouldArchive}`);
      const shouldUnarchive = !shouldArchive;

      if (viewCount && viewCount > 0) {
        updateData.videoplaycount = viewCount;
        updateData.videoviewcount = viewCount;
      } else {
        updateData.videoplaycount = 0;
        updateData.videoviewcount = 0;
      }

      if (typeof transformed.likescount === 'number') {
        updateData.likescount = transformed.likescount;
      }
      if (typeof transformed.commentscount === 'number') {
        updateData.commentscount = transformed.commentscount;
      }

      updateData.is_archived = shouldArchive;

      if (shouldArchive && reel.caption && !reel.caption.startsWith('[Archived]')) {
        updateData.caption = `[Archived] ${reel.caption}`;
      } else if (shouldUnarchive && reel.caption && reel.caption.startsWith('[Archived]')) {
        updateData.caption = reel.caption.replace(/^\[Archived\]\s*/, '');
      }

      if (transformed.video_duration) updateData.video_duration = transformed.video_duration;
      if (transformed.takenat && !reel.takenat) updateData.takenat = transformed.takenat;

      const { error } = await supabase.from("reels").update(updateData).eq("id", reel.id);
      if (error) throw error;
    } else {
      const APIFY_API_URL = "https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items";
      const APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || "";

      const response = await fetch(`${APIFY_API_URL}?token=${APIFY_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [url], resultsLimit: 1 }),
      });

      if (!response.ok) throw new Error(`Apify API error: ${response.status}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const reelData = data[0];
        const { error } = await supabase.from("reels").update({
          videoplaycount: reelData.videoPlayCount || reelData.playCount || 0,
          likescount: reelData.likesCount || 0,
          commentscount: reelData.commentsCount || 0,
          lastupdatedat: new Date().toISOString(),
        }).eq("id", reel.id);

        if (error) throw error;
      } else {
        throw new Error("No data returned from API");
      }
    }
  };

  // Process the refresh queue one by one
  const processRefreshQueue = useCallback(async () => {
    if (isProcessingRef.current || refreshQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    while (refreshQueueRef.current.length > 0) {
      const item = refreshQueueRef.current[0];
      const { reel, id } = item;

      // Move from queued to refreshing
      setQueuedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setRefreshingIds(prev => new Set(prev).add(id));

      try {
        await processOneReel(reel);
        toast.success(`✅ Refreshed ${reel.shortcode || reel.ownerusername || 'reel'}`);
        onUpdate();
      } catch (error) {
        console.error("Error refreshing reel:", error);
        toast.error(`❌ Failed: ${reel.shortcode || reel.ownerusername} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Remove from refreshing
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      // Remove from queue
      refreshQueueRef.current.shift();

      // Small delay between requests
      if (refreshQueueRef.current.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    isProcessingRef.current = false;
  }, [onUpdate]);

  // Add reel to refresh queue
  const handleRefreshReel = useCallback((reel: Reel) => {
    // Try all available URL sources, including constructing from shortcode
    const url = reel.permalink || reel.url || reel.inputurl || 
      (reel.shortcode ? `https://www.instagram.com/p/${reel.shortcode}/` : null);
    if (!url) {
      toast.error("No URL available for this reel (no permalink, url, or shortcode)");
      return;
    }

    // Check if already in queue or refreshing
    if (queuedIds.has(reel.id) || refreshingIds.has(reel.id)) {
      toast.info(`Already ${refreshingIds.has(reel.id) ? 'refreshing' : 'queued'}: ${reel.shortcode || reel.ownerusername}`);
      return;
    }

    // Add to queue
    refreshQueueRef.current.push({ reel, id: reel.id });
    setQueuedIds(prev => new Set(prev).add(reel.id));
    
    const queuePosition = refreshQueueRef.current.length;
    if (queuePosition > 1) {
      toast.info(`📋 Queued #${queuePosition}: ${reel.shortcode || reel.ownerusername}`);
    }

    // Start processing
    processRefreshQueue();
  }, [queuedIds, refreshingIds, processRefreshQueue]);

  // Get total queue count
  const totalInQueue = refreshingIds.size + queuedIds.size;

  return (
    <div className="rounded-lg border bg-card">
      {/* Queue Status Bar */}
      {totalInQueue > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-blue-700">
              {refreshingIds.size > 0 && `Refreshing ${refreshingIds.size}`}
              {refreshingIds.size > 0 && queuedIds.size > 0 && ' • '}
              {queuedIds.size > 0 && `${queuedIds.size} in queue`}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-blue-600 hover:text-blue-700"
            onClick={() => {
              refreshQueueRef.current = [];
              setQueuedIds(new Set());
              toast.info("Queue cleared");
            }}
          >
            Clear Queue
          </Button>
        </div>
      )}
      
      {/* Top Horizontal Scrollbar */}
      <div 
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden border-b bg-muted/30"
        style={{ height: '12px' }}
      >
        <div style={{ width: scrollWidth, height: '12px' }} />
      </div>
      
      {/* Table with synced scroll */}
      <div ref={tableScrollRef} className="overflow-x-auto">
        <Table className="relative">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Status</TableHead>
            <TableHead className="sticky left-[85px] bg-background z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Username</TableHead>
            <TableHead>Caption</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Language</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="text-right">Comments</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right sticky right-0 bg-background z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                No reels found
              </TableCell>
            </TableRow>
          ) : (
            reels.map((reel) => (
              <TableRow 
                key={reel.id}
                className={reel.is_archived ? "opacity-60 bg-muted/30" : ""}
              >
                <TableCell className={`sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${reel.is_archived ? 'bg-muted/30' : 'bg-background'}`}>
                  {reel.is_archived ? (
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Archive className="h-3 w-3" />
                      Archived
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Active
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={`font-medium sticky left-[85px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${reel.is_archived ? 'bg-muted/30' : 'bg-background'}`}>{reel.ownerusername || "-"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {reel.caption || "-"}
                </TableCell>
                <TableCell>
                  {editingLocationId === reel.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        value={editLocationValue}
                        onChange={(e) => setEditLocationValue(e.target.value)}
                        className="w-32 h-8"
                        placeholder="Location"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSaveLocation(reel.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingLocationId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="max-w-xs truncate">{reel.locationname || "-"}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEditLocation(reel.id, reel.locationname || null)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingLanguageId === reel.id ? (
                    <div className="flex items-center gap-1">
                      <Select value={editLanguageValue} onValueChange={setEditLanguageValue}>
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSaveLanguage(reel.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingLanguageId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {reel.language || "Hinglish"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEditLanguage(reel.id, reel.language || null)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">{reel.likescount?.toLocaleString() || 0}</TableCell>
                <TableCell className="text-right">{reel.commentscount?.toLocaleString() || 0}</TableCell>
                <TableCell className="text-right">{reel.videoplaycount?.toLocaleString() || 0}</TableCell>
                <TableCell className="text-right">
                  {editingId === reel.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(parseFloat(e.target.value))}
                        className="w-24 h-8"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSavePayout(reel.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <span>₹{typeof reel.payout === 'number' ? reel.payout.toFixed(2) : parseFloat(String(reel.payout || '0')).toFixed(2)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEditPayout(reel.id, typeof reel.payout === 'number' ? reel.payout : parseFloat(String(reel.payout || '0')))}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {reel.takenat ? new Date(reel.takenat).toLocaleDateString() : "-"}
                </TableCell>
                <TableCell className={`text-right sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${reel.is_archived ? 'bg-muted/30' : 'bg-background'}`}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 ${
                        refreshingIds.has(reel.id) 
                          ? 'text-blue-600' 
                          : queuedIds.has(reel.id) 
                            ? 'text-amber-500' 
                            : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      }`}
                      onClick={() => handleRefreshReel(reel)}
                      disabled={refreshingIds.has(reel.id) || queuedIds.has(reel.id)}
                      title={
                        refreshingIds.has(reel.id) 
                          ? 'Refreshing...' 
                          : queuedIds.has(reel.id) 
                            ? `Queued (${refreshQueueRef.current.findIndex(item => item.id === reel.id) + 1} in queue)` 
                            : 'Refresh reel data'
                      }
                    >
                      {refreshingIds.has(reel.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : queuedIds.has(reel.id) ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    {(() => {
                      // Get the best available URL for the reel
                      const reelUrl = reel.permalink || reel.url || reel.inputurl || 
                        (reel.shortcode ? `https://www.instagram.com/p/${reel.shortcode}/` : null);
                      return reelUrl ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => window.open(reelUrl, "_blank")}
                          title="Open in Instagram"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : null;
                    })()}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(reel.id)}
                      title="Delete reel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};

export default ReelsTable;
