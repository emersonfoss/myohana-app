import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Camera, Plus, X, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family, FamilyMember, Photo } from "@shared/schema";

export default function Photos() {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [uploadedById, setUploadedById] = useState("");
  const [filterMember, setFilterMember] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });

  const uploadPhoto = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/memories"] });
      resetForm();
      setUploadOpen(false);
      toast({ title: "Photo uploaded", description: "Your photo has been added to the album." });
    },
  });

  const resetForm = () => {
    setCaption("");
    setTakenAt("");
    setUploadedById("");
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !familyData?.family) return;
    const formData = new FormData();
    formData.append("photo", selectedFile);
    formData.append("familyId", String(familyData.family.id));
    formData.append("uploadedById", uploadedById || String(familyData.members[0]?.id || 1));
    if (caption) formData.append("caption", caption);
    if (takenAt) formData.append("takenAt", new Date(takenAt).toISOString());
    uploadPhoto.mutate(formData);
  };

  const family = familyData?.family;
  const members = familyData?.members || [];

  const filteredPhotos = useMemo(() => {
    const list = photos || [];
    if (filterMember === "all") return list;
    return list.filter(p => p.uploadedById === Number(filterMember));
  }, [photos, filterMember]);

  const lightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  const navigateLightbox = (dir: -1 | 1) => {
    if (lightboxIndex === null) return;
    const next = lightboxIndex + dir;
    if (next >= 0 && next < filteredPhotos.length) {
      setLightboxIndex(next);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto page-enter" data-testid="photos-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Family Photos
          </h1>
          <p className="text-sm text-muted-foreground">
            {filteredPhotos.length} {filteredPhotos.length === 1 ? "photo" : "photos"}
            {family ? ` in the ${family.name} album` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Member filter chips */}
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-[140px]" data-testid="select-photo-filter">
              <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.emoji} {m.name.split(" ")[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-photo">
                <Plus className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                  className="text-xl"
                >
                  Upload a Photo
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* File input */}
                <div className="space-y-2">
                  <Label>Image</Label>
                  {previewUrl ? (
                    <div className="relative">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 bg-black/50 text-white hover:bg-black/70 h-6 w-6"
                        onClick={() => { setSelectedFile(null); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        data-testid="button-remove-preview"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-amber-300/70 dark:border-amber-600/50 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="dropzone-photo"
                    >
                      <Camera className="h-9 w-9 mx-auto text-amber-400 mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">Drop your family moments here</p>
                      <p className="text-xs text-muted-foreground mt-1">or click to select — JPEG, PNG, GIF, or WebP (max 10MB)</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-photo-file"
                  />
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <Label htmlFor="caption">Caption</Label>
                  <Textarea
                    id="caption"
                    placeholder="What's happening in this photo?"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    data-testid="input-photo-caption"
                  />
                </div>

                {/* Date taken */}
                <div className="space-y-2">
                  <Label htmlFor="takenAt">When was this taken?</Label>
                  <Input
                    id="takenAt"
                    type="date"
                    value={takenAt}
                    onChange={(e) => setTakenAt(e.target.value)}
                    data-testid="input-photo-date"
                  />
                </div>

                {/* Uploaded by */}
                <div className="space-y-2">
                  <Label>Uploaded by</Label>
                  <Select value={uploadedById} onValueChange={setUploadedById}>
                    <SelectTrigger data-testid="select-photo-uploader">
                      <SelectValue placeholder="Select family member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.emoji} {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadPhoto.isPending}
                  data-testid="button-submit-photo"
                >
                  {uploadPhoto.isPending ? "Uploading..." : "Upload Photo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Photo Grid — Masonry with CSS columns */}
      {isLoading ? (
        <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl break-inside-avoid" />
          ))}
        </div>
      ) : filteredPhotos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-12 w-12 mb-4 text-amber-300" />
            <h3
              className="font-semibold text-xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              No photos yet
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Upload your first family moment to start building your album.
            </p>
            <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-first">
              <Plus className="h-4 w-4 mr-2" />
              Upload First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
          {filteredPhotos.map((photo, idx) => {
            const uploader = members.find((m) => m.id === photo.uploadedById);
            return (
              <Card
                key={photo.id}
                className="overflow-hidden cursor-pointer group break-inside-avoid border border-amber-100/60 dark:border-amber-900/30 shadow-[0_2px_12px_rgba(180,120,60,0.07)] hover:shadow-[0_4px_20px_rgba(180,120,60,0.14)] transition-all duration-300 rounded-xl"
                onClick={() => setLightboxIndex(idx)}
                data-testid={`photo-card-${photo.id}`}
              >
                <div className="relative overflow-hidden rounded-t-xl">
                  <img
                    src={photo.url}
                    alt={photo.caption || "Family photo"}
                    className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <CardContent className="p-3 space-y-1">
                  {photo.caption && (
                    <p
                      className="text-sm font-medium line-clamp-2"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                    >
                      {photo.caption}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{uploader?.emoji} {uploader?.name.split(" ")[0] || "Unknown"}</span>
                    <span>
                      {photo.takenAt
                        ? format(parseISO(photo.takenAt), "MMM d, yyyy")
                        : formatDistanceToNow(parseISO(photo.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lightbox with prev/next navigation */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-[#1a1510] border-[#2e2418]">
          {lightboxPhoto && (
            <>
              <div className="relative">
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.caption || "Family photo"}
                  className="w-full max-h-[70vh] object-contain bg-[#1a1510]"
                  data-testid="lightbox-image"
                />
                {/* Navigation arrows */}
                {lightboxIndex !== null && lightboxIndex > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                    data-testid="button-lightbox-prev"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                {lightboxIndex !== null && lightboxIndex < filteredPhotos.length - 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                    data-testid="button-lightbox-next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
                {/* Position indicator */}
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {(lightboxIndex ?? 0) + 1} / {filteredPhotos.length}
                </div>
              </div>
              <div className="p-5 space-y-2 bg-[#1a1510]">
                {lightboxPhoto.caption && (
                  <p
                    className="font-medium text-amber-100/90 text-lg"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                  >
                    {lightboxPhoto.caption}
                  </p>
                )}
                <div className="flex items-center gap-3 text-sm text-amber-200/60">
                  <span>
                    {members.find((m) => m.id === lightboxPhoto.uploadedById)?.emoji}{" "}
                    {members.find((m) => m.id === lightboxPhoto.uploadedById)?.name || "Unknown"}
                  </span>
                  <span>&middot;</span>
                  <span>
                    {lightboxPhoto.takenAt
                      ? format(parseISO(lightboxPhoto.takenAt), "MMMM d, yyyy")
                      : format(parseISO(lightboxPhoto.createdAt), "MMMM d, yyyy")}
                  </span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
