import { useState } from "react";
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

const ReelsTable = ({ reels, onUpdate }: ReelsTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocationValue, setEditLocationValue] = useState<string>("");
  const [editingLanguageId, setEditingLanguageId] = useState<string | null>(null);
  const [editLanguageValue, setEditLanguageValue] = useState<string>("Hinglish");

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
    const { error } = await supabase
      .from("reels")
      .update({ language: editLanguageValue || "Hinglish" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update language");
    } else {
      toast.success("Language updated successfully");
      setEditingLanguageId(null);
      onUpdate();
    }
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
            reels.map((reel) => (
              <TableRow 
                key={reel.id}
                className={reel.is_archived ? "opacity-60 bg-muted/30" : ""}
              >
                <TableCell>
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
                <TableCell className="font-medium">{reel.ownerusername || "-"}</TableCell>
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
                          {LANGUAGES.map((lang) => (
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
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {reel.permalink && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => window.open(reel.permalink!, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(reel.id)}
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
  );
};

export default ReelsTable;
