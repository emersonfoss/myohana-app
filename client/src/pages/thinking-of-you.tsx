import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family, FamilyMember, ThinkingOfYouPulse } from "@shared/schema";

export default function ThinkingOfYou() {
  const { toast } = useToast();
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
    onSuccess: (_data, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/thinking-of-you"] });
      const recipient = members.find((m) => m.id === variables.recipientId);
      toast({ title: "Pulse sent 💛", description: `${recipient?.name.split(" ")[0] || "They"} knows you're thinking of them.` });
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
    <div className="p-4 sm:p-6 space-y-12 max-w-2xl mx-auto page-enter" data-testid="thinking-of-you-page">
      {/* Header */}
      <div className="text-center pt-6">
        <Heart className="h-10 w-10 mx-auto text-rose-400 fill-rose-200 mb-4" />
        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Thinking of You
        </h1>
        <p className="text-sm text-muted-foreground">
          Let someone know they're on your mind
        </p>
      </div>

      {/* Family member grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 justify-items-center">
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
                {/* Warm gold ripple effect */}
                {isAnimating && (
                  <div className="absolute inset-0 w-24 h-24 rounded-full bg-amber-400/20 animate-ripple" />
                )}
                <div
                  className={`w-24 h-24 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-4xl transition-all duration-200 ring-2 ring-transparent group-hover:ring-amber-300/70 dark:group-hover:ring-amber-500/50 group-hover:shadow-[0_0_0_6px_rgba(251,191,36,0.12)] ${
                    isAnimating ? "animate-pulse-warm" : "group-hover:scale-105"
                  }`}
                >
                  {member.emoji}
                </div>
              </div>
              <div className="text-center transition-opacity">
                <p
                  className="font-semibold text-sm group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.05rem" }}
                >
                  {member.name.split(" ")[0]}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Recent pulses feed */}
      <div className="space-y-4">
        <h2
          className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest"
        >
          Recent Pulses
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : recentPulses.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <Heart className="h-12 w-12 mx-auto mb-4 text-rose-300" />
              <h3
                className="font-semibold text-xl mb-2"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Nobody's sent a pulse yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Be the first to brighten someone's day.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentPulses.map((pulse) => {
              const sender = members.find((m) => m.id === pulse.senderId);
              const recipient = members.find((m) => m.id === pulse.recipientId);
              return (
                <div
                  key={pulse.id}
                  className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/30"
                  data-testid={`pulse-${pulse.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{sender?.emoji || "?"}</span>
                    <span
                      className="text-sm font-medium"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1rem" }}
                    >
                      {sender?.name.split(" ")[0] || "Unknown"}
                    </span>
                    <span className="text-sm text-muted-foreground">thought of</span>
                    <span
                      className="text-sm font-medium"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1rem" }}
                    >
                      {recipient?.name.split(" ")[0] || "Unknown"}
                    </span>
                    <span className="text-base">{recipient?.emoji || "?"}</span>
                    <span className="text-amber-500 text-sm">💛</span>
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
