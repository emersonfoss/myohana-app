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
import { MessageCircle, Heart, Shield } from "lucide-react";
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
    <div className="p-6 space-y-6 max-w-4xl mx-auto" data-testid="family-page">
      <h1 className="text-xl font-bold">{familyData?.family.name || "Family"}</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Card
              key={member.id}
              className="cursor-pointer transition-colors"
              onClick={() => setSelectedMember(member)}
              data-testid={`family-card-${member.id}`}
            >
              <CardContent className="pt-6 pb-4 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mx-auto mb-3">
                  {member.emoji}
                </div>
                <h3 className="font-bold text-base">{member.name}</h3>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {roleLabel(member.role)}
                </Badge>
                {member.age !== null && member.age !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {member.age === 0 ? "Newborn" : `Age ${member.age}`}
                  </p>
                )}
                {member.description && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
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
        <DialogContent className="max-w-md">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{selectedMember.emoji}</span>
                  {selectedMember.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="secondary">{roleLabel(selectedMember.role)}</Badge>
                  {selectedMember.age !== null && selectedMember.age !== undefined && (
                    <span className="text-muted-foreground">
                      {selectedMember.age === 0 ? "Newborn" : `Age ${selectedMember.age}`}
                    </span>
                  )}
                </div>
                {selectedMember.description && (
                  <p className="text-sm italic text-muted-foreground">{selectedMember.description}</p>
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
                        <div key={msg.id} className="text-xs p-2 bg-muted rounded-md">
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
                        <div key={doc.id} className="text-xs p-2 bg-muted rounded-md">
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
