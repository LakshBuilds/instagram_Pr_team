import { useState, useMemo, useRef, useEffect } from "react";
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
import { Trash2, ExternalLink, Pencil, Check, X, Archive, RefreshCw, Loader2, Copy, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiProvider } from "@/lib/apiProvider";
import { fetchFromInternalApi, transformInternalApiToReel } from "@/lib/internalApi";

// Indian cities list for location autocomplete
const INDIAN_LOCATIONS = [
  "Mumbai, India",
  "Delhi, India",
  "Bangalore, India",
  "Hyderabad, India",
  "Chennai, India",
  "Kolkata, India",
  "Pune, India",
  "Ahmedabad, India",
  "Jaipur, India",
  "Lucknow, India",
  "Chandigarh, India",
  "Gurgaon, India",
  "Noida, India",
  "Indore, India",
  "Bhopal, India",
  "Surat, India",
  "Nagpur, India",
  "Kochi, India",
  "Thiruvananthapuram, India",
  "Coimbatore, India",
  "Vizag, India",
  "Patna, India",
  "Ranchi, India",
  "Bhubaneswar, India",
  "Guwahati, India",
  "Dehradun, India",
  "Shimla, India",
  "Amritsar, India",
  "Ludhiana, India",
  "Agra, India",
  "Varanasi, India",
  "Kanpur, India",
  "Mysore, India",
  "Mangalore, India",
  "Udaipur, India",
  "Jodhpur, India",
  "Raipur, India",
  "Goa, India",
  "Pondicherry, India",
  "Faridabad, India",
  "Ghaziabad, India",
  "Vadodara, India",
  "Rajkot, India",
  "Nashik, India",
  "Aurangabad, India",
  "Jabalpur, India",
  "Vijayawada, India",
  "Madurai, India",
  "Tiruchirappalli, India",
  "Salem, India",
];

interface Reel {
  id: string; // Database UUID - unique per row
  ownerusername: string | null;
  caption: string | null;
  likescount: number | null;
  commentscount: number | null;
  videoplaycount: number | null;
  videoviewcount?: number | null;
  payout: number | string | null;
  permalink: string | null;
  takenat: string | null;
  is_archived?: boolean | null;
  locationname?: string | null;
  language?: string | null;
  url?: string | null;
  inputurl?: string | null;
  shortcode?: string | null; // Instagram shortcode - same for duplicates
}

const LANGUAGES = [
  "Hinglish",
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Urdu",
  "Kannada",
  "Odia",
  "Malayalam",
  "Punjabi",
  "Assamese",
  "Maithili",
  "Konkani",
  "Sindhi",
  "Kashmiri",
  "Dogri",
  "Manipuri (Meiteilon)",
];

interface ReelsTableProps {
  reels: Reel[];
  onUpdate: () => void;
}

// Location Autocomplete Component
const LocationAutocomplete = ({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.length > 0) {
      const filtered = INDIAN_LOCATIONS.filter(loc =>
        loc.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8);
      setFilteredLocations(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredLocations(INDIAN_LOCATIONS.slice(0, 8));
      setShowSuggestions(true);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center gap-1">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          className="w-40 h-8 pr-8"
          placeholder="Search city..."
        />
        <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 top-full left-0 mt-1 w-56 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg"
          >
            {filteredLocations.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No locations found</div>
            ) : (
              filteredLocations.map((location) => (
                <button
                  key={location}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                  onClick={() => { onChange(location); setShowSuggestions(false); }}
                >
                  <MapPin className="h-3 w-3 text-primary" />
                  {location}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSave}>
        <Check className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

const ReelsTable = ({ reels, onUpdate }: ReelsTableProps) => {
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editingLocationRowKey, setEditingLocationRowKey] = useState<string | null>(null);
  const [editLocationValue, setEditLocationValue] = useState<string>("");
  const [editingLanguageRowKey, setEditingLanguageRowKey] = useState<string | null>(null);
  const [editLanguageValue, setEditLanguageValue] = useState<string>("Hinglish");
  const [refreshingRowKey, setRefreshingRowKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Generate unique row key using index (handles duplicates with same id)
  const getRowKey = (index: number) => `row-${index}`;

  // Find duplicates by shortcode
  const duplicateShortcodes = useMemo(() => {
    const shortcodeCounts = new Map<string, number>();
    reels.forEach(reel => {
      const shortcode = reel.shortcode || "";
      if (shortcode) {
        shortcodeCounts.set(shortcode, (shortcodeCounts.get(shortcode) || 0) + 1);
      }
    });
    return new Set(
      Array.from(shortcodeCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([shortcode]) => shortcode)
    );
  }, [reels]);

  const isDuplicate = (reel: Reel) => {
    const shortcode = reel.shortcode || "";
    return shortcode && duplicateShortcodes.has(shortcode);
  };

  // Delete using the database UUID (reel.id)
  const handleDelete = async (id: string, shortcode?: string) => {
    if (!id) {
      toast.error("Cannot delete: missing reel ID");
      return;
    }

    setDeletingId(id);
    console.log(`🗑️ Deleting reel - ID: ${id}, Shortcode: ${shortcode || 'N/A'}`);
    
    try {
      const { error } = await supabase
        .from("reels")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete error:", error);
        toast.error(`Failed to delete: ${error.message}`);
      } else {
        console.log("✅ Deleted successfully");
        toast.success(`Deleted reel${shortcode ? ` (${shortcode})` : ''}`);
        onUpdate();
      }
    } catch (err) {
      console.error("Delete exception:", err);
      toast.error("Failed to delete reel");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefreshReel = async (reel: Reel, rowKey: string) => {
    const url = reel.permalink || reel.url || reel.inputurl;
    if (!url) {
      toast.error("No URL available for this reel");
      return;
    }

    setRefreshingRowKey(rowKey);
    const provider = getApiProvider();

    try {
      if (provider === 'internal') {
        const response = await fetchFromInternalApi(url, 5);
        const transformed = transformInternalApiToReel(response, url);
        
        const updateData: any = {
          lastupdatedat: new Date().toISOString(),
        };
        
        // Update views only if > 0 (to protect against API failures)
        const viewCount = transformed.videoplaycount || transformed.videoviewcount;
        const likesCount = typeof transformed.likescount === 'number' ? transformed.likescount : 0;
        const commentsCount = typeof transformed.commentscount === 'number' ? transformed.commentscount : 0;
        
        // Check if reel should be marked as archived (all counts are 0)
        const shouldArchive = viewCount === 0 && likesCount === 0 && commentsCount === 0;
        
        if (viewCount > 0) {
          updateData.videoplaycount = viewCount;
          updateData.videoviewcount = viewCount;
        } else {
          // If views are 0, update them (might be archived/deleted)
          updateData.videoplaycount = 0;
          updateData.videoviewcount = 0;
        }
        // Update likes and comments if defined (including 0, which is valid)
        if (typeof transformed.likescount === 'number') {
          updateData.likescount = transformed.likescount;
        }
        if (typeof transformed.commentscount === 'number') {
          updateData.commentscount = transformed.commentscount;
        }
        
        // Mark as archived by updating caption if all counts are 0
        if (shouldArchive && reel.caption && !reel.caption.startsWith('[Archived]')) {
          updateData.caption = `[Archived] ${reel.caption}`;
        }
        
        if (transformed.video_duration) updateData.video_duration = transformed.video_duration;
        if (transformed.takenat && !reel.takenat) updateData.takenat = transformed.takenat;
        
        const { error } = await supabase.from("reels").update(updateData).eq("id", reel.id);
        if (error) throw error;
        toast.success(`Refreshed ${reel.shortcode || reel.ownerusername || 'reel'}`);
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
          toast.success(`Refreshed ${reel.shortcode || reel.ownerusername || 'reel'}`);
        } else {
          toast.warning("No data returned from API");
        }
      }
      onUpdate();
    } catch (error) {
      console.error("Error refreshing reel:", error);
      toast.error(`Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRefreshingRowKey(null);
    }
  };

  const handleEditPayout = (rowKey: string, currentPayout: number) => {
    setEditingRowKey(rowKey);
    setEditValue(currentPayout);
  };

  const handleSavePayout = async (id: string) => {
    const { error } = await supabase.from("reels").update({ payout: editValue }).eq("id", id);
    if (error) {
      toast.error("Failed to update payout");
    } else {
      toast.success("Payout updated");
      setEditingRowKey(null);
      onUpdate();
    }
  };

  const handleEditLocation = (rowKey: string, currentLocation: string | null) => {
    setEditingLocationRowKey(rowKey);
    setEditLocationValue(currentLocation || "");
  };

  const handleSaveLocation = async (id: string) => {
    const { error } = await supabase.from("reels").update({ locationname: editLocationValue || null }).eq("id", id);
    if (error) {
      toast.error("Failed to update location");
    } else {
      toast.success("Location updated");
      setEditingLocationRowKey(null);
      onUpdate();
    }
  };

  const handleEditLanguage = (rowKey: string, currentLanguage: string | null) => {
    setEditingLanguageRowKey(rowKey);
    setEditLanguageValue(currentLanguage || "Hinglish");
  };

  const handleSaveLanguage = async (id: string) => {
    const { error } = await supabase.from("reels").update({ language: editLanguageValue || "Hinglish" } as any).eq("id", id);
    if (error) {
      toast.error("Failed to update language");
    } else {
      toast.success("Language updated");
      setEditingLanguageRowKey(null);
      onUpdate();
    }
  };

  const getStatusBadge = (reel: Reel) => {
    if (isDuplicate(reel)) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
          <Copy className="h-3 w-3" />
          Duplicate
        </Badge>
      );
    }
    // Check if archived by caption prefix or if all counts are 0
    const isArchived = reel.caption?.startsWith('[Archived]') || 
                      (reel.videoplaycount === 0 && reel.videoviewcount === 0 && 
                       reel.likescount === 0 && reel.commentscount === 0);
    if (isArchived || reel.is_archived) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
          <Archive className="h-3 w-3" />
          Archived
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600 border-green-600">
        Active
      </Badge>
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Caption</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Language</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="text-right">Comments</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
            reels.map((reel, index) => {
              const rowKey = getRowKey(index);
              const isDeleting = deletingId === reel.id;
              // Check if archived by caption prefix or if all counts are 0
              const isArchived = reel.caption?.startsWith('[Archived]') || 
                                (reel.videoplaycount === 0 && reel.videoviewcount === 0 && 
                                 reel.likescount === 0 && reel.commentscount === 0) ||
                                reel.is_archived;
              return (
                <TableRow 
                  key={rowKey}
                  className={`${isArchived ? "opacity-60 bg-muted/30" : ""} ${isDuplicate(reel) ? "bg-red-50 dark:bg-red-950/20" : ""} ${isDeleting ? "opacity-50" : ""}`}
                >
                  <TableCell>{getStatusBadge(reel)}</TableCell>
                  <TableCell className="font-medium">{reel.ownerusername || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">{reel.caption || "-"}</TableCell>
                  <TableCell>
                    {editingLocationRowKey === rowKey ? (
                      <LocationAutocomplete
                        value={editLocationValue}
                        onChange={setEditLocationValue}
                        onSave={() => handleSaveLocation(reel.id)}
                        onCancel={() => setEditingLocationRowKey(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="max-w-xs truncate">{reel.locationname || "-"}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditLocation(rowKey, reel.locationname || null)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingLanguageRowKey === rowKey ? (
                      <div className="flex items-center gap-1">
                        <Select value={editLanguageValue} onValueChange={setEditLanguageValue}>
                          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LANGUAGES.map((lang) => (
                              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveLanguage(reel.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingLanguageRowKey(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{reel.language || "Hinglish"}</Badge>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditLanguage(rowKey, reel.language || null)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{reel.likescount?.toLocaleString() || 0}</TableCell>
                  <TableCell className="text-right">{reel.commentscount?.toLocaleString() || 0}</TableCell>
                  <TableCell className="text-right">{(reel.videoplaycount || reel.videoviewcount)?.toLocaleString() || 0}</TableCell>
                  <TableCell className="text-right">
                    {editingRowKey === rowKey ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(parseFloat(e.target.value))} className="w-24 h-8" />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSavePayout(reel.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingRowKey(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span>₹{typeof reel.payout === 'number' ? reel.payout.toFixed(2) : parseFloat(String(reel.payout || '0')).toFixed(2)}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditPayout(rowKey, typeof reel.payout === 'number' ? reel.payout : parseFloat(String(reel.payout || '0')))}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{reel.takenat ? new Date(reel.takenat).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      // Prefer explicit permalink, but fall back to url/inputurl or build from shortcode
                      const permalink =
                        reel.permalink ||
                        reel.url ||
                        reel.inputurl ||
                        (reel.shortcode ? `https://www.instagram.com/p/${reel.shortcode}/` : null);

                      return (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleRefreshReel(reel, rowKey)}
                            disabled={refreshingRowKey === rowKey}
                            title="Refresh reel data"
                          >
                            {refreshingRowKey === rowKey ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          {permalink && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => window.open(permalink, "_blank")}
                              title="Open in Instagram"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50"
                            onClick={() => handleDelete(reel.id, reel.shortcode || undefined)}
                            disabled={isDeleting}
                            title={`Delete reel (Shortcode: ${reel.shortcode || 'N/A'})`}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ReelsTable;
