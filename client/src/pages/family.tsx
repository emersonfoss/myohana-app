import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Heart, Shield, Users } from "lucide-react";
import { format } from "date-fns";
import type { Family, FamilyMember, Message, ThinkingOfYouPulse, VaultDocument } from "@shared/schema";

export default function FamilyPage() {
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  const { data: familyData, isLoading } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const { data: pulses } = useQuery<ThinkingOfYouPulse[]>({
    queryKey: ["/api/thinking-of-you"],
  });

  const { data: vaultDocs } = useQuery<VaultDocument[]>({
    queryKey: ["/api/vault"],
  });

  const members = familyData?.members || [];

  const getMemberMessages = (memberId: number) => {
    return (messages || []).filter(
      (m) => m.authorId === memberId || m.recipientId === memberId
    );
  };

  const getMemberPulses = (memberId: number) => {
    return (pulses || []).filter(
      (p) => p.senderId === memberId || p.recipientId === memberId
    );
  };

  const getMemberDocs = (memberId: number) => {
    return (vaultDocs || []).filter(
      (d) => d.uploadedById === memberId
    );
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "dad": return "Father";
      case "mom": return "Mother";
      case "child": return "Child";
      case "baby": return "Baby";
      default: return role;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto page-enter" data-testid="family-page">
      <div className="flex items-center gap-2.5">
        <Users className="h-6 w-6 text-amber-600 dark:text-amber-500" />
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {familyData?.family.name || "Our Family"}
        </h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Card
              key={member.id}
              className="cursor-pointer card-hover border-amber-100/80 dark:border-amber-900/20 shadow-sm shadow-amber-100/40 dark:shadow-none transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-amber-100/60 dark:hover:shadow-amber-900/20"
              onClick={() => setSelectedMember(member)}
              data-testid={`family-card-${member.id}`}
            >
              <CardContent className="pt-8 pb-5 px-4 text-center">
                <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-200 dark:ring-amber-800/40 flex items-center justify-center text-5xl mx-auto mb-4">
                  {member.emoji}
                </div>
                <h3
                  className="font-bold text-xl leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {member.name}
                </h3>
                <Badge
                  variant="secondary"
                  className={`mt-2 text-xs rounded-full ${
                    member.role === "dad" || member.role === "mom"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : member.role === "baby"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  }`}
                >
                  {roleLabel(member.role)}
                </Badge>
                {member.age !== null && member.age !== undefined && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {member.age === 0 ? "Newborn" : `${member.age} year${member.age !== 1 ? "s" : ""} old`}
                  </p>
                )}
                {member.description && (
                  <p className="text-xs text-muted-foreground/70 mt-2 italic leading-relaxed">
                    {member.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Member detail dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-md border-amber-100 dark:border-amber-900/30">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-3xl w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-200 dark:ring-amber-800/40 flex items-center justify-center shrink-0">
                    {selectedMember.emoji}
                  </span>
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }} className="text-2xl font-bold">
                    {selectedMember.name}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex items-center gap-3 text-sm">
                  <Badge
                    variant="secondary"
                    className={`rounded-full text-xs ${
                      selectedMember.role === "dad" || selectedMember.role === "mom"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : selectedMember.role === "baby"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    }`}
                  >
                    {roleLabel(selectedMember.role)}
                  </Badge>
                  {selectedMember.age !== null && selectedMember.age !== undefined && (
                    <span className="text-muted-foreground">
                      {selectedMember.age === 0 ? "Newborn" : `${selectedMember.age} year${selectedMember.age !== 1 ? "s" : ""} old`}
                    </span>
                  )}
                </div>
                {selectedMember.description && (
                  <p className="text-sm italic text-muted-foreground/80 leading-relaxed">{selectedMember.description}</p>
                )}

                {/* Their messages */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Messages</h3>
                  </div>
                  {getMemberMessages(selectedMember.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No messages yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {getMemberMessages(selectedMember.id).slice(0, 5).map((msg) => (
                        <div key={msg.id} className="text-xs p-2 bg-amber-50/60 dark:bg-amber-900/10 rounded-md border border-amber-100/60 dark:border-amber-900/20">
                          <span className="font-medium">{msg.title}</span>
                          <span className="text-muted-foreground ml-2">
                            {format(new Date(msg.createdAt), "MMM d")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Their pulses */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Heart className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Thinking of You</h3>
                  </div>
                  {getMemberPulses(selectedMember.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No pulses yet</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {getMemberPulses(selectedMember.id).length} pulse{getMemberPulses(selectedMember.id).length !== 1 ? "s" : ""} sent or received
                    </p>
                  )}
                </div>

                {/* Their vault docs */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Vault Documents</h3>
                  </div>
                  {getMemberDocs(selectedMember.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No documents uploaded</p>
                  ) : (
                    <div className="space-y-1.5">
                      {getMemberDocs(selectedMember.id).map((doc) => (
                        <div key={doc.id} className="text-xs p-2 bg-amber-50/60 dark:bg-amber-900/10 rounded-md border border-amber-100/60 dark:border-amber-900/20">
                          <span className="font-medium">{doc.name}</span>
                          <Badge variant="outline" className="ml-2 text-[10px]">{doc.category}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
