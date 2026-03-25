import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Family, FamilyMember, ThinkingOfYouPulse } from "@shared/schema";

export default function ThinkingOfYou() {
  const [animatingId, setAnimatingId] = useState<number | null>(null);

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: pulses, isLoading } = useQuery<ThinkingOfYouPulse[]>({
    queryKey: ["/api/thinking-of-you"],
  });

  const sendPulse = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/thinking-of-you", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/thinking-of-you"] });
    },
  });

  const family = familyData?.family;
  const members = familyData?.members || [];

  const handleSendPulse = (recipientId: number) => {
    if (!family) return;
    setAnimatingId(recipientId);
    sendPulse.mutate({
      familyId: family.id,
      senderId: members[0]?.id || 1, // Default to Dad
      recipientId,
    });
    setTimeout(() => setAnimatingId(null), 800);
  };

  const recentPulses = (pulses || []).slice(0, 20);

  return (
    <div className="p-6 space-y-10 max-w-2xl mx-auto" data-testid="thinking-of-you-page">
      {/* Header */}
      <div className="text-center pt-4">
        <Heart className="h-8 w-8 mx-auto text-primary mb-3" />
        <h1 className="text-xl font-bold">Thinking of You</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Let someone know they're on your mind
        </p>
      </div>

      {/* Family member grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 justify-items-center">
        {members.map((member) => {
          const isAnimating = animatingId === member.id;
          return (
            <button
              key={member.id}
              onClick={() => handleSendPulse(member.id)}
              className="flex flex-col items-center gap-3 group focus:outline-none"
              data-testid={`pulse-member-${member.id}`}
            >
              <div className="relative">
                {/* Ripple effect */}
                {isAnimating && (
                  <div className="absolute inset-0 w-20 h-20 rounded-full bg-primary/20 animate-ripple" />
                )}
                <div
                  className={`w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl transition-transform ${
                    isAnimating ? "animate-pulse-warm" : "group-hover:scale-105"
                  }`}
                >
                  {member.emoji}
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">{member.name.split(" ")[0]}</p>
                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent pulses feed */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 text-center">
          Recent Pulses
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : recentPulses.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No pulses yet. Tap someone above to send the first one.
          </p>
        ) : (
          <div className="space-y-2">
            {recentPulses.map((pulse) => {
              const sender = members.find((m) => m.id === pulse.senderId);
              const recipient = members.find((m) => m.id === pulse.recipientId);
              return (
                <div
                  key={pulse.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-card"
                  data-testid={`pulse-${pulse.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{sender?.emoji || "?"}</span>
                    <span className="text-sm font-medium">
                      {sender?.name.split(" ")[0] || "Unknown"}
                    </span>
                    <Heart className="h-3 w-3 text-primary fill-primary" />
                    <span className="text-sm font-medium">
                      {recipient?.name.split(" ")[0] || "Unknown"}
                    </span>
                    <span className="text-sm">{recipient?.emoji || "?"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(parseISO(pulse.createdAt), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
