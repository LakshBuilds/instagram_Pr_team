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
import { Trash2, ExternalLink, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
}

interface ReelsTableProps {
  reels: Reel[];
  onUpdate: () => void;
}

const ReelsTable = ({ reels, onUpdate }: ReelsTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

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

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Caption</TableHead>
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
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No reels found
              </TableCell>
            </TableRow>
          ) : (
            reels.map((reel) => (
              <TableRow key={reel.id}>
                <TableCell className="font-medium">{reel.ownerusername || "-"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {reel.caption || "-"}
                </TableCell>
                <TableCell className="text-right">{reel.likescount?.toLocaleString() || 0}</TableCell>
                <TableCell className="text-right">{reel.commentscount?.toLocaleString() || 0}</TableCell>
                <TableCell className="text-right">{reel.videoviewcount?.toLocaleString() || 0}</TableCell>
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
                      <span>${reel.payout?.toFixed(2) || "0.00"}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEditPayout(reel.id, reel.payout || 0)}
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
