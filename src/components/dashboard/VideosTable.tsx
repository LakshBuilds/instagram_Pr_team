import { useState, useRef, useEffect } from "react";
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
import { Trash2, ExternalLink, Pencil, Check, X, Archive } from "lucide-react";
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

import type { Video } from "@/lib/types";
import { LANGUAGES } from "@/lib/constants";

interface VideosTableProps {
  videos: Video[];
  onUpdate: () => void;
}

const VideosTable = ({ videos, onUpdate }: VideosTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editingLanguageId, setEditingLanguageId] = useState<string | null>(null);
  const [editLanguageValue, setEditLanguageValue] = useState<string>("English");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState<string>("");

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;
    if (!topScroll || !tableScroll) return;
    setScrollWidth(tableScroll.scrollWidth);
    const syncTopToTable = () => { if (tableScroll) tableScroll.scrollLeft = topScroll.scrollLeft; };
    const syncTableToTop = () => { if (topScroll) topScroll.scrollLeft = tableScroll.scrollLeft; };
    topScroll.addEventListener('scroll', syncTopToTable);
    tableScroll.addEventListener('scroll', syncTableToTop);
    const resizeObserver = new ResizeObserver(() => { setScrollWidth(tableScroll.scrollWidth); });
    resizeObserver.observe(tableScroll);
    return () => {
      topScroll.removeEventListener('scroll', syncTopToTable);
      tableScroll.removeEventListener('scroll', syncTableToTop);
      resizeObserver.disconnect();
    };
  }, [videos]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete video");
    } else {
      toast.success("Video deleted successfully");
      onUpdate();
    }
  };

  const handleEditPayout = (id: string, currentPayout: number) => {
    setEditingId(id);
    setEditValue(currentPayout);
  };

  const handleSavePayout = async (id: string) => {
    const { error } = await supabase.from("videos").update({ payout: editValue }).eq("id", id);
    if (error) {
      toast.error("Failed to update payout");
    } else {
      toast.success("Payout updated successfully");
      setEditingId(null);
      onUpdate();
    }
  };

  const handleSaveLanguage = async (id: string) => {
    const { error } = await supabase
      .from("videos")
      .update({ language: editLanguageValue || "English" })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update language");
    } else {
      toast.success("Language updated!");
      setEditingLanguageId(null);
      onUpdate();
    }
  };

  const handleSaveCategory = async (id: string) => {
    const { error } = await supabase
      .from("videos")
      .update({ category: editCategoryValue || null })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update category");
    } else {
      toast.success("Category updated!");
      setEditingCategoryId(null);
      onUpdate();
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-lg border bg-card">
      <div
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden border-b bg-muted/30"
        style={{ height: '12px' }}
      >
        <div style={{ width: scrollWidth, height: '12px' }} />
      </div>

      <div ref={tableScrollRef} className="overflow-x-auto">
        <Table className="relative">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Status</TableHead>
              <TableHead className="sticky left-[85px] bg-background z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Channel</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Language</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Payout</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right sticky right-0 bg-background z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No videos found
                </TableCell>
              </TableRow>
            ) : (
              videos.map((video) => (
                <TableRow
                  key={video.id}
                  className={video.is_archived ? "opacity-60 bg-muted/30" : ""}
                >
                  <TableCell className={`sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${video.is_archived ? 'bg-muted/30' : 'bg-background'}`}>
                    {video.is_archived ? (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <Archive className="h-3 w-3" />
                        Archived
                      </Badge>
                    ) : video.is_short ? (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        Short
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Video
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={`font-medium sticky left-[85px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${video.is_archived ? 'bg-muted/30' : 'bg-background'}`}>
                    {video.channel_name || "-"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {video.title || "-"}
                  </TableCell>
                  <TableCell>
                    {editingCategoryId === video.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          value={editCategoryValue}
                          onChange={(e) => setEditCategoryValue(e.target.value)}
                          className="w-28 h-8"
                          placeholder="Category"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveCategory(video.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingCategoryId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{video.category || "-"}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingCategoryId(video.id); setEditCategoryValue(video.category || ""); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingLanguageId === video.id ? (
                      <div className="flex items-center gap-1">
                        <Select value={editLanguageValue} onValueChange={setEditLanguageValue}>
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGES.map((lang) => (
                              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveLanguage(video.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingLanguageId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{video.language || "-"}</Badge>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingLanguageId(video.id); setEditLanguageValue(video.language || "English"); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{(Number(video.view_count) || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{(Number(video.like_count) || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{(Number(video.comment_count) || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatDuration(video.duration_seconds)}</TableCell>
                  <TableCell className="text-right">
                    {editingId === video.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(parseFloat(e.target.value))} className="w-24 h-8" />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSavePayout(video.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span>₹{typeof video.payout === 'number' ? video.payout.toFixed(2) : parseFloat(String(video.payout || '0')).toFixed(2)}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditPayout(video.id, typeof video.payout === 'number' ? video.payout : parseFloat(String(video.payout || '0')))}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {video.published_at ? new Date(video.published_at).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className={`text-right sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${video.is_archived ? 'bg-muted/30' : 'bg-background'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {video.video_url && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(video.video_url!, "_blank")} title="Open on YouTube">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(video.id)} title="Delete video">
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

export default VideosTable;
