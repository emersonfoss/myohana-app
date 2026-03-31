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
        <div className="flex items-center gap-2.5">
          <Play className="h-6 w-6 text-amber-600 dark:text-amber-500" />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Media Room
          </h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-media">
              <Plus className="h-4 w-4 mr-1" />
              Add Media
            </Button>
          </DialogTrigger>
          <DialogContent className="border-amber-100 dark:border-amber-900/30">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }} className="text-xl">Add Media</DialogTitle>
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
        <h2 className="text-xs font-semibold text-amber-700/70 dark:text-amber-400/70 uppercase tracking-widest mb-3">
          Videos
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : videos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Play className="h-12 w-12 mx-auto mb-4 text-amber-400/60" />
              <h3
                className="font-bold text-xl mb-1"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Start building your family media library
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Add videos, books, and music.</p>
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
                  className="overflow-hidden cursor-pointer group card-hover border-amber-100/80 dark:border-amber-900/20 shadow-sm shadow-amber-100/40 dark:shadow-none"
                  data-testid={`media-card-${item.id}`}
                >
                  <div
                    className="relative aspect-video bg-amber-50/50 dark:bg-amber-900/10 rounded-t-md overflow-hidden"
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
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-900/10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white/95 shadow-md flex items-center justify-center">
                        <Play className="h-5 w-5 text-amber-700 ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="py-3 px-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{item.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-full">
                            {item.type}
                          </Badge>
                          {ages.map((age: string, idx: number) => (
                            <Badge key={idx} variant="outline" className={`text-[10px] rounded-full ${
                              age === "all" ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" :
                              age === "13+" ? "border-amber-400 text-amber-700 dark:text-amber-400" :
                              "border-amber-200 text-amber-600 dark:text-amber-500"
                            }`}>
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

      {/* Books section */}
      <div>
        <h2 className="text-xs font-semibold text-amber-700/70 dark:text-amber-400/70 uppercase tracking-widest mb-3">
          Books
        </h2>
        {books.length === 0 ? (
          <Card className="border-amber-100/80 dark:border-amber-900/20">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-amber-400/50" />
              <h3
                className="font-semibold text-base mb-1"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                No books added yet
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Add a book for the family using the Add Media button above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {books.map((item) => {
              const ages = item.approvedForAges ? JSON.parse(item.approvedForAges) : [];
              return (
                <Card key={item.id} className="card-hover border-amber-100/80 dark:border-amber-900/20" data-testid={`book-card-${item.id}`}>
                  <CardContent className="py-3 px-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-amber-600/70 dark:text-amber-500/70 shrink-0" />
                          <p
                            className="font-semibold text-sm truncate"
                            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                          >
                            {item.title}
                          </p>
                        </div>
                        {ages.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 ml-6">
                            {ages.map((age: string, idx: number) => (
                              <Badge key={idx} variant="outline" className={`text-[10px] rounded-full ${
                                age === "all" ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" :
                                age === "13+" ? "border-amber-400 text-amber-700 dark:text-amber-400" :
                                "border-amber-200 text-amber-600 dark:text-amber-500"
                              }`}>
                                {age}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMedia.mutate(item.id)}
                        data-testid={`button-delete-book-${item.id}`}
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
    </div>
  );
}
