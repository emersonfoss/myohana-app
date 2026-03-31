import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Image, Calendar, Shield, Heart, Send, Plus } from "lucide-react";
import { Link } from "wouter";
import { format, getHours } from "date-fns";
import { OnboardingWizard, useOnboarding } from "@/components/onboarding-wizard";
import type { Family, FamilyMember, Message } from "@shared/schema";

function getTimeGreeting(): string {
  const hour = getHours(new Date());
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatWarmDate(date: Date): string {
  // e.g. "Tuesday, March 31st"
  const dayName = format(date, "EEEE");
  const monthName = format(date, "MMMM");
  const day = date.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
      ? "nd"
      : day === 3 || day === 23
      ? "rd"
      : "th";
  return `${dayName}, ${monthName} ${day}${suffix}`;
}

export default function Dashboard() {
  const { isOnboarded, markOnboarded } = useOnboarding();
  const [showWizard, setShowWizard] = useState(!isOnboarded);

  const { data: familyData, isLoading: familyLoading } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    messageCount: number;
    photoCount: number;
    eventCount: number;
    vaultCount: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const { data: recentMessages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const today = formatWarmDate(new Date());
  const greeting = getTimeGreeting();

  if (familyLoading || statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const members = familyData?.members || [];
  const messages = (recentMessages || []).slice(0, 5);

  const statCards = [
    { label: "Messages", value: stats?.messageCount || 0, icon: MessageCircle, color: "text-[#C4944A]", bg: "from-amber-50/80 to-white dark:from-amber-950/20 dark:to-background" },
    { label: "Photos", value: stats?.photoCount || 0, icon: Image, color: "text-rose-400", bg: "from-rose-50/80 to-white dark:from-rose-950/20 dark:to-background" },
    { label: "Events", value: stats?.eventCount || 0, icon: Calendar, color: "text-sky-400", bg: "from-sky-50/80 to-white dark:from-sky-950/20 dark:to-background" },
    { label: "Vault Docs", value: stats?.vaultCount || 0, icon: Shield, color: "text-muted-foreground", bg: "from-stone-50/80 to-white dark:from-stone-950/20 dark:to-background" },
  ];

  return (
    <>
      {showWizard && (
        <OnboardingWizard
          onComplete={() => {
            markOnboarded();
            setShowWizard(false);
          }}
        />
      )}
      <div className="p-4 sm:p-6 space-y-8 max-w-5xl mx-auto page-enter" data-testid="dashboard-page">
        {/* Welcome header */}
        <div>
          <h1
            className="text-3xl font-semibold leading-snug"
            style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', Georgia, serif)" }}
            data-testid="text-welcome"
          >
            {greeting},{" "}
            <span className="text-[#C4944A]">
              {familyData?.family.name || "Family"}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{today}</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <Card
              key={stat.label}
              className={`card-hover border-border/60 bg-gradient-to-br ${stat.bg} shadow-sm`}
              data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center justify-between gap-1 mb-3">
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {stat.label}
                  </span>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p
                  className="text-3xl font-bold tabular-nums"
                  style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', Georgia, serif)" }}
                >
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Family members strip */}
        <div>
          <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
            Your Family
          </h2>
          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <span className="text-3xl">🏡</span>
              <p className="text-sm">No members yet — add your family!</p>
            </div>
          ) : (
            <>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col items-center gap-1.5 min-w-[76px] group cursor-default"
                    data-testid={`member-avatar-${member.id}`}
                  >
                    <div className="w-14 h-14 rounded-full bg-[#C4944A]/10 flex items-center justify-center text-2xl ring-2 ring-transparent group-hover:ring-[#C4944A]/40 transition-all duration-200">
                      {member.emoji}
                    </div>
                    <span className="text-xs font-medium text-center whitespace-nowrap">
                      {member.name.split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 capitalize">{member.role}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground/50 mt-3 italic">
                Thinking of someone? Send a little love →
              </p>
            </>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Link href="/messages">
            <Button
              className="bg-[#C4944A] hover:bg-[#A07038] text-white border-0"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4 mr-2" />
              💬 Send a Message
            </Button>
          </Link>
          <Link href="/vault">
            <Button variant="secondary" data-testid="button-add-vault">
              <Plus className="h-4 w-4 mr-2" />
              🗂️ Add to Vault
            </Button>
          </Link>
          <Link href="/thinking-of-you">
            <Button variant="outline" className="border-[#C4944A]/30 hover:border-[#C4944A]/60 hover:bg-[#C4944A]/5" data-testid="button-thinking-of-you">
              <Heart className="h-4 w-4 mr-2 text-[#C4944A]" />
              Thinking of You
            </Button>
          </Link>
        </div>

        {/* Recent messages */}
        <div>
          <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
            Recent Messages
          </h2>
          {messagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <Card className="border-dashed border-[#C4944A]/20 bg-[#C4944A]/3">
              <CardContent className="py-10 text-center">
                <p className="text-2xl mb-2">✉️</p>
                <p className="text-sm text-muted-foreground">No messages yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Be the first to say something nice!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const author = members.find((m) => m.id === msg.authorId);
                const isRose = msg.type === "rose";
                const isThorn = msg.type === "thorn";
                return (
                  <Card
                    key={msg.id}
                    className={`card-hover border-border/50 ${
                      isRose
                        ? "bg-rose-50/60 dark:bg-rose-950/15 border-rose-200/40 dark:border-rose-800/30"
                        : isThorn
                        ? "bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/40 dark:border-amber-800/30"
                        : ""
                    }`}
                    data-testid={`message-preview-${msg.id}`}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#C4944A]/10 flex items-center justify-center text-sm shrink-0 mt-0.5">
                          {author?.emoji || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{author?.name || "Unknown"}</span>
                            {msg.type !== "text" && (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${
                                  isRose
                                    ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
                                    : isThorn
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                    : ""
                                }`}
                              >
                                {isRose ? "🌹 Rose" : isThorn ? "🌿 Thorn" : msg.type}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(msg.createdAt), "MMM d")}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-0.5">{msg.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
