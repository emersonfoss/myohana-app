import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Play, BookOpen, Music, X, Film } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family, FamilyMember, MediaItem } from "@shared/schema";

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function getThumbnailUrl(url: string): string {
  const id = getYouTubeId(url);
  if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  return "";
}

const typeIcons: Record<string, typeof Play> = {
  youtube: Play,
  book: BookOpen,
  music: Music,
};

export default function Media() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [newMedia, setNewMedia] = useState({
    title: "",
    url: "",
    type: "youtube",
    approvedForAges: "all",
  });

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: mediaItems, isLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/media"],
  });

  const createMedia = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/media", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      setDialogOpen(false);
      setNewMedia({ title: "", url: "", type: "youtube", approvedForAges: "all" });
      toast({ title: "Media added", description: "Your content has been added to the media room." });
    },
  });

  const deleteMedia = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/media/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Media removed", description: "The item has been removed from the media room." });
    },
  });

  const family = familyData?.family;
  const members = familyData?.members || [];

  const handleSubmit = () => {
    if (!family || !newMedia.title || !newMedia.url) return;
    createMedia.mutate({
      familyId: family.id,
      addedById: members[0]?.id || 1,
      title: newMedia.title,
      url: newMedia.url,
      type: newMedia.type,
      approvedForAges: JSON.stringify([newMedia.approvedForAges]),
    });
  };

  const videos = (mediaItems || []).filter((m) => m.type === "youtube");
  const books = (mediaItems || []).filter((m) => m.type === "book");

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto page-enter" data-testid="media-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Media Room</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-media">
              <Plus className="h-4 w-4 mr-1" />
              Add Media
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Media</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Title</Label>
                <Input
                  value={newMedia.title}
                  onChange={(e) => setNewMedia((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Baby Shark"
                  data-testid="input-media-title"
                />
              </div>
              <div>
                <Label>URL</Label>
                <Input
                  value={newMedia.url}
                  onChange={(e) => setNewMedia((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                  data-testid="input-media-url"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={newMedia.type}
                  onValueChange={(v) => setNewMedia((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger data-testid="select-media-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube Video</SelectItem>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="music">Music</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Approved For Ages</Label>
                <Select
                  value={newMedia.approvedForAges}
                  onValueChange={(v) => setNewMedia((p) => ({ ...p, approvedForAges: v }))}
                >
                  <SelectTrigger data-testid="select-media-ages">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ages</SelectItem>
                    <SelectItem value="3+">Ages 3+</SelectItem>
                    <SelectItem value="5+">Ages 5+</SelectItem>
                    <SelectItem value="8+">Ages 8+</SelectItem>
                    <SelectItem value="13+">Ages 13+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={createMedia.isPending || !newMedia.title || !newMedia.url}
                className="w-full"
                data-testid="button-submit-media"
              >
                {createMedia.isPending ? "Adding..." : "Add Media"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* YouTube Player Dialog */}
      <Dialog open={!!playerUrl} onOpenChange={() => setPlayerUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Now Playing</DialogTitle>
          </DialogHeader>
          {playerUrl && (
            <div className="aspect-video w-full mt-2">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(playerUrl)}?autoplay=1`}
                className="w-full h-full rounded-md"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube Player"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Videos section */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Videos
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : videos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Film className="h-12 w-12 mx-auto mb-4 empty-state-icon" />
              <h3 className="font-semibold text-lg mb-1">Your media room is empty</h3>
              <p className="text-sm text-muted-foreground mb-4">Add some approved content for the family.</p>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-first-media">
                <Plus className="h-4 w-4 mr-2" />
                Add First Video
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {videos.map((item) => {
              const ages = item.approvedForAges ? JSON.parse(item.approvedForAges) : [];
              return (
                <Card
                  key={item.id}
                  className="overflow-hidden cursor-pointer group card-hover"
                  data-testid={`media-card-${item.id}`}
                >
                  <div
                    className="relative aspect-video bg-muted"
                    onClick={() => setPlayerUrl(item.url)}
                  >
                    <img
                      src={getThumbnailUrl(item.url)}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="h-5 w-5 text-foreground ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="py-3 px-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {item.type}
                          </Badge>
                          {ages.map((age: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-[10px]">
                              {age}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMedia.mutate(item.id);
                        }}
                        data-testid={`button-delete-media-${item.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Books section (placeholder for future) */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Books
        </h2>
        {books.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Book recommendations coming soon!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {books.map((item) => (
              <Card key={item.id}>
                <CardContent className="py-3 px-3">
                  <p className="font-medium text-sm">{item.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
