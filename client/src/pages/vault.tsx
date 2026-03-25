import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, FileText, Shield, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: documents, isLoading } = useQuery<VaultDocument[]>({
    queryKey: ["/api/vault"],
  });

  const createDoc = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/vault", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDialogOpen(false);
      setNewDoc({ name: "", category: "legal", description: "", expiresAt: "" });
      toast({ title: "Document added", description: "Your document has been saved to the vault." });
    },
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vault/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Document removed", description: "The document has been removed from the vault." });
    },
  });

  const family = familyData?.family;
  const members = familyData?.members || [];

  const handleSubmit = () => {
    if (!family || !newDoc.name || !newDoc.category) return;
    createDoc.mutate({
      familyId: family.id,
      uploadedById: members[0]?.id || 1,
      name: newDoc.name,
      category: newDoc.category,
      description: newDoc.description || null,
      expiresAt: newDoc.expiresAt || null,
    });
  };

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              <Button
                onClick={handleSubmit}
                disabled={createDoc.isPending || !newDoc.name}
                className="w-full"
                data-testid="button-submit-document"
              >
                {createDoc.isPending ? "Adding..." : "Add Document"}
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
                return (
                  <Card key={doc.id} className="card-hover" data-testid={`vault-doc-${doc.id}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{doc.name}</span>
                            <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-md font-medium ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
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
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteDoc.mutate(doc.id)}
                          data-testid={`button-delete-doc-${doc.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
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
