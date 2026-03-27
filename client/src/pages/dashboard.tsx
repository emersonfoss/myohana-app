import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Image, Calendar, Shield, Heart, Send, Plus } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { OnboardingWizard, useOnboarding } from "@/components/onboarding-wizard";
import type { Family, FamilyMember, Message } from "@shared/schema";

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

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  if (familyLoading || statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const members = familyData?.members || [];
  const messages = (recentMessages || []).slice(0, 5);

  const statCards = [
    { label: "Messages", value: stats?.messageCount || 0, icon: MessageCircle, color: "text-primary" },
    { label: "Photos", value: stats?.photoCount || 0, icon: Image, color: "text-chart-2" },
    { label: "Events", value: stats?.eventCount || 0, icon: Calendar, color: "text-secondary" },
    { label: "Vault Docs", value: stats?.vaultCount || 0, icon: Shield, color: "text-muted-foreground" },
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
        <h1 className="text-xl font-bold" data-testid="text-welcome">
          Welcome home, {familyData?.family.name || "Family"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{today}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="card-hover" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </span>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Family members strip */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Family
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col items-center gap-1 min-w-[72px]"
              data-testid={`member-avatar-${member.id}`}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                {member.emoji}
              </div>
              <span className="text-xs font-medium text-center whitespace-nowrap">
                {member.name.split(" ")[0]}
              </span>
              <span className="text-[10px] text-muted-foreground capitalize">{member.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Link href="/messages">
          <Button data-testid="button-send-message">
            <Send className="h-4 w-4 mr-2" />
            Send a Message
          </Button>
        </Link>
        <Link href="/vault">
          <Button variant="secondary" data-testid="button-add-vault">
            <Plus className="h-4 w-4 mr-2" />
            Add to Vault
          </Button>
        </Link>
        <Link href="/thinking-of-you">
          <Button variant="outline" data-testid="button-thinking-of-you">
            <Heart className="h-4 w-4 mr-2" />
            Thinking of You
          </Button>
        </Link>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Recent Messages
        </h2>
        {messagesLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No messages yet. Send the first one!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const author = members.find(m => m.id === msg.authorId);
              return (
                <Card key={msg.id} className="card-hover" data-testid={`message-preview-${msg.id}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm shrink-0 mt-0.5">
                        {author?.emoji || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{author?.name || "Unknown"}</span>
                          {msg.type !== "text" && (
                            <Badge variant="secondary" className="text-[10px]">
                              {msg.type === "rose" ? "Rose" : msg.type === "thorn" ? "Thorn" : msg.type}
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
