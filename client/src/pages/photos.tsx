import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { ensureCsrfToken } from "@/lib/queryClient";
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
import { Camera, Plus, X, Upload, ChevronLeft, ChevronRight, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { Family, FamilyMember, Photo } from "@shared/schema";

// Google Photos import flow states
type ImportStep = "idle" | "creating" | "waiting" | "importing" | "done" | "error";

function GooglePhotosImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      cleanup();
      setStep("idle");
      setSessionId(null);
      setPickerUri(null);
      setImportedCount(0);
      setErrorMsg("");
    }
  }, [open, cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const startSession = async () => {
    setStep("creating");
    try {
      const token = await ensureCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-csrf-token"] = token;
      const res = await fetch("/api/google-photos/session", {
        method: "POST",
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to create session");
      const data = await res.json();
      setSessionId(data.sessionId);
      setPickerUri(data.pickerUri);
      setStep("waiting");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create Google Photos session");
      setStep("error");
    }
  };

  const openPicker = () => {
    if (pickerUri) window.open(pickerUri, "_blank");
  };

  // Start polling when we enter "waiting" step
  useEffect(() => {
    if (step !== "waiting" || !sessionId) return;
    cleanup();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/google-photos/session/${sessionId}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.mediaItemsSet) {
          cleanup();
          setStep("importing");
          // Trigger import
          try {
            const token = await ensureCsrfToken();
            const importHeaders: Record<string, string> = {};
            if (token) importHeaders["x-csrf-token"] = token;
            const importRes = await fetch(`/api/google-photos/import/${sessionId}`, {
              method: "POST",
              headers: importHeaders,
              credentials: "include",
            });
            if (!importRes.ok) throw new Error((await importRes.text()) || "Import failed");
            const importData = await importRes.json();
            setImportedCount(importData.imported ?? importData.count ?? 0);
            setStep("done");
            queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
            queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/memories"] });
          } catch (err: any) {
            setErrorMsg(err.message || "Failed to import photos");
            setStep("error");
          }
        }
      } catch {
        // Polling error — will retry on next interval
      }
    }, 5000);
    return cleanup;
  }, [step, sessionId, cleanup]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            className="text-xl"
          >
            Import from Google Photos
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {step === "idle" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Select photos from your Google Photos library to import into your family album.
              </p>
              <Button onClick={startSession} data-testid="button-start-google-import">
                Start Import
              </Button>
            </div>
          )}

          {step === "creating" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">Setting up Google Photos...</p>
            </div>
          )}

          {step === "waiting" && (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Google Photos will open in a new tab. Select the photos you want to import, then come back here.
                </p>
              </div>
              <Button onClick={openPicker} data-testid="button-open-google-picker">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Google Photos
              </Button>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for your selection...
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground font-medium">Importing your photos...</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p
                className="text-lg font-semibold"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Imported {importedCount} {importedCount === 1 ? "photo" : "photos"}
              </p>
              <p className="text-sm text-muted-foreground">Your photos are now in your family album.</p>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-import"
              >
                Done
              </Button>
            </div>
          )}

          {step === "error" && (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => { setStep("idle"); setErrorMsg(""); }}>
                  Try Again
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Photos() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [uploadedById, setUploadedById] = useState("");
  const [filterMember, setFilterMember] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Photos connection status
  const { data: googleStatus } = useQuery<{ connected: boolean; email?: string }>({
    queryKey: ["/api/google-photos/status"],
    retry: false,
    staleTime: 60_000,
  });

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });

  const uploadPhoto = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = await ensureCsrfToken();
      const headers: Record<string, string> = {};
      if (token) headers["x-csrf-token"] = token;
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
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

          {/* Google Photos import button */}
          {googleStatus?.connected ? (
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              data-testid="button-import-google-photos"
            >
              <span className="font-bold text-sm mr-1.5" aria-hidden="true">G</span>
              Import from Google
            </Button>
          ) : googleStatus && !googleStatus.connected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
              className="text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400"
              data-testid="button-connect-google-photos"
            >
              Connect Google Photos
            </Button>
          ) : null}

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

      {/* Google Photos Import Dialog */}
      <GooglePhotosImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
