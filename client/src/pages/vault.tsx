import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Plus, Trash2, Shield, AlertTriangle, CheckCircle, Clock, Upload, Download, X, FileIcon } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getFileIcon, formatFileSize } from "@/lib/file-icons";
import type { Family, FamilyMember, VaultDocument } from "@shared/schema";

const CATEGORIES = ["legal", "health", "insurance", "identity", "financial"] as const;

const categoryConfig: Record<string, { label: string; color: string }> = {
  legal: { label: "Legal", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  health: { label: "Health", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  insurance: { label: "Insurance", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  identity: { label: "Identity", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  financial: { label: "Financial", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
};

function getExpiryStatus(expiresAt: string | null) {
  if (!expiresAt) return null;
  const days = differenceInDays(parseISO(expiresAt), new Date());
  if (days < 0) return { label: "Expired", icon: AlertTriangle, className: "text-destructive" };
  if (days <= 30) return { label: `Expires in ${days}d`, icon: Clock, className: "text-amber-600 dark:text-amber-400" };
  return { label: `Valid until ${format(parseISO(expiresAt), "MMM d, yyyy")}`, icon: CheckCircle, className: "text-secondary" };
}

export default function Vault() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    name: "",
    category: "legal",
    description: "",
    expiresAt: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: documents, isLoading } = useQuery<VaultDocument[]>({
    queryKey: ["/api/vault"],
  });

  const createDoc = useMutation({
    mutationFn: async (data: { formData: FormData } | { json: any }) => {
      if ("formData" in data) {
        setUploadProgress(10);
        const res = await fetch("/api/vault", {
          method: "POST",
          body: data.formData,
          credentials: "include",
        });
        setUploadProgress(90);
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }
        setUploadProgress(100);
        return res.json();
      }
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.json),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Document added", description: "Your document has been saved to the vault." });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setUploadProgress(0);
    },
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/vault/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Document removed", description: "The document has been removed from the vault." });
    },
  });

  const downloadDoc = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/vault/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get download link");
      const data = await res.json();
      return data.downloadUrl;
    },
    onSuccess: (url: string) => {
      window.open(url, "_blank");
    },
    onError: () => {
      toast({ title: "Download failed", description: "Could not generate download link.", variant: "destructive" });
    },
  });

  const family = familyData?.family;
  const members = familyData?.members || [];

  const resetForm = () => {
    setNewDoc({ name: "", category: "legal", description: "", expiresAt: "" });
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!family || !newDoc.name || !newDoc.category) return;

    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("familyId", String(family.id));
      formData.append("uploadedById", String(members[0]?.id || 1));
      formData.append("name", newDoc.name);
      formData.append("category", newDoc.category);
      if (newDoc.description) formData.append("description", newDoc.description);
      if (newDoc.expiresAt) formData.append("expiresAt", newDoc.expiresAt);
      createDoc.mutate({ formData });
    } else {
      createDoc.mutate({
        json: {
          familyId: family.id,
          uploadedById: members[0]?.id || 1,
          name: newDoc.name,
          category: newDoc.category,
          description: newDoc.description || null,
          expiresAt: newDoc.expiresAt || null,
        },
      });
    }
  };

  const handleFileSelect = (file: File) => {
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Maximum file size is 25MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  // Group by category
  const grouped = (documents || []).reduce<Record<string, VaultDocument[]>>((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto page-enter" data-testid="vault-page">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Family Vault</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-document">
              <Plus className="h-4 w-4 mr-1" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Document Name</Label>
                <Input
                  value={newDoc.name}
                  onChange={(e) => setNewDoc((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Birth Certificate"
                  data-testid="input-doc-name"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={newDoc.category}
                  onValueChange={(v) => setNewDoc((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger data-testid="select-doc-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {categoryConfig[cat].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newDoc.description}
                  onChange={(e) => setNewDoc((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                  data-testid="input-doc-description"
                />
              </div>
              <div>
                <Label>Expiration Date</Label>
                <Input
                  type="date"
                  value={newDoc.expiresAt}
                  onChange={(e) => setNewDoc((p) => ({ ...p, expiresAt: e.target.value }))}
                  data-testid="input-doc-expires"
                />
              </div>

              {/* File Upload */}
              <div>
                <Label>Attach File (optional)</Label>
                <div
                  className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="vault-file-dropzone"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-2">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Drag & drop or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        PDF, JPEG, PNG, DOCX, XLSX (max 25MB)
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    data-testid="vault-file-input"
                  />
                </div>
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <Progress value={uploadProgress} className="h-2" />
              )}

              <Button
                onClick={handleSubmit}
                disabled={createDoc.isPending || !newDoc.name}
                className="w-full"
                data-testid="button-submit-document"
              >
                {createDoc.isPending ? "Uploading..." : "Add Document"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 empty-state-icon" />
            <h3 className="font-semibold text-lg mb-1">Your vault is empty</h3>
            <p className="text-sm text-muted-foreground mb-4">Start by adding important family documents.</p>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-first-document">
              <Plus className="h-4 w-4 mr-2" />
              Add First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        CATEGORIES.map((cat) => {
          const docs = grouped[cat];
          if (!docs || docs.length === 0) return null;
          const config = categoryConfig[cat];
          return (
            <div key={cat} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {config.label}
              </h2>
              {docs.map((doc) => {
                const expiry = getExpiryStatus(doc.expiresAt);
                const uploader = members.find((m) => m.id === doc.uploadedById);
                const FileTypeIcon = getFileIcon(doc.mimeType);
                return (
                  <Card key={doc.id} className="card-hover" data-testid={`vault-doc-${doc.id}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 flex-1 min-w-0">
                          {doc.fileKey ? (
                            <div className="mt-0.5">
                              <FileTypeIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{doc.name}</span>
                              <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-md font-medium ${config.color}`}>
                                {config.label}
                              </span>
                              {!doc.fileKey && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-muted text-muted-foreground">
                                  Metadata only
                                </span>
                              )}
                            </div>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {doc.fileSize && (
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(doc.fileSize)}
                                </span>
                              )}
                              {expiry && (
                                <span className={`flex items-center gap-1 text-xs ${expiry.className}`}>
                                  <expiry.icon className="h-3 w-3" />
                                  {expiry.label}
                                </span>
                              )}
                              {uploader && (
                                <span className="text-xs text-muted-foreground">
                                  Added by {uploader.name.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {doc.fileKey && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => downloadDoc.mutate(doc.id)}
                              disabled={downloadDoc.isPending}
                              data-testid={`button-download-doc-${doc.id}`}
                            >
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteDoc.mutate(doc.id)}
                            data-testid={`button-delete-doc-${doc.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
