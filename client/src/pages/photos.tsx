import { useState, useRef } from "react";
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
import { Camera, Plus, X, Upload } from "lucide-react";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family, FamilyMember, Photo } from "@shared/schema";

export default function Photos() {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [uploadedById, setUploadedById] = useState("");
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
  const photoList = photos || [];

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-4xl mx-auto page-enter" data-testid="photos-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Camera className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Photos</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your family's captured moments
          </p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-photo">
              <Plus className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload a Photo</DialogTitle>
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
                      className="w-full h-48 object-cover rounded-md"
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
                    className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="dropzone-photo"
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select an image</p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, GIF, or WebP (max 10MB)</p>
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

      {/* Photo Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : photoList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No photos yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your first family photo to start building your album
            </p>
            <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-first">
              <Plus className="h-4 w-4 mr-2" />
              Upload First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photoList.map((photo) => {
            const uploader = members.find((m) => m.id === photo.uploadedById);
            return (
              <Card
                key={photo.id}
                className="overflow-hidden cursor-pointer group hover:ring-2 hover:ring-primary/30 transition-all"
                onClick={() => setLightboxPhoto(photo)}
                data-testid={`photo-card-${photo.id}`}
              >
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={photo.url}
                    alt={photo.caption || "Family photo"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardContent className="p-3 space-y-1">
                  {photo.caption && (
                    <p className="text-sm font-medium line-clamp-2">{photo.caption}</p>
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

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          {lightboxPhoto && (
            <>
              <div className="relative">
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.caption || "Family photo"}
                  className="w-full max-h-[70vh] object-contain bg-black"
                  data-testid="lightbox-image"
                />
              </div>
              <div className="p-4 space-y-2">
                {lightboxPhoto.caption && (
                  <p className="font-medium">{lightboxPhoto.caption}</p>
                )}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    {members.find((m) => m.id === lightboxPhoto.uploadedById)?.emoji}{" "}
                    {members.find((m) => m.id === lightboxPhoto.uploadedById)?.name || "Unknown"}
                  </span>
                  <span>•</span>
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
