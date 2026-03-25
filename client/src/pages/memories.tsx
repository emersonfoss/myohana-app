import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Camera, MessageCircle, Calendar, Heart } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Family, FamilyMember } from "@shared/schema";

interface WeeklyPhoto {
  id: number;
  url: string;
  caption: string | null;
  takenAt: string | null;
  createdAt: string;
  uploadedBy: string;
}

interface WeeklyMessage {
  id: number;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  authorName: string;
  authorEmoji: string;
  recipientName: string;
}

interface WeeklyEvent {
  id: number;
  title: string;
  startDate: string;
  location: string | null;
  memberNames: string[];
}

interface PulseSummary {
  sender: string;
  recipient: string;
  count: number;
  senderEmoji: string;
}

interface WeeklyCompilation {
  weekOf: string;
  photos: WeeklyPhoto[];
  messages: WeeklyMessage[];
  events: WeeklyEvent[];
  pulses: PulseSummary[];
  highlights: string;
  generatedAt: string;
}

export default function Memories() {
  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: weekly, isLoading } = useQuery<WeeklyCompilation>({
    queryKey: ["/api/memory/weekly"],
  });

  return (
    <div className="p-4 sm:p-6 space-y-10 max-w-3xl mx-auto page-enter" data-testid="memories-page">
      {/* Hero */}
      <div className="text-center pt-6 pb-2">
        <Sparkles className="h-8 w-8 mx-auto text-primary mb-3" />
        <h1 className="text-2xl font-bold tracking-tight font-serif">
          Your Week, Beautifully Told
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          A gentle look back at the moments that made this week special for the{" "}
          {familyData?.family?.name || "family"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : weekly ? (
        <>
          {/* Week label + highlights */}
          <div className="text-center space-y-3">
            <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
              Week of {weekly.weekOf}
            </div>
            <p className="text-base text-foreground leading-relaxed max-w-lg mx-auto" data-testid="weekly-highlights">
              {weekly.highlights}
            </p>
          </div>

          {/* Photo Gallery */}
          {weekly.photos.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">This Week's Photos</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {weekly.photos.map((photo) => (
                  <Card key={photo.id} className="overflow-hidden" data-testid={`memory-photo-${photo.id}`}>
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.caption || "Family photo"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {photo.caption && (
                      <CardContent className="p-2">
                        <p className="text-xs text-muted-foreground line-clamp-2">{photo.caption}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Message Highlights */}
          {weekly.messages.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Messages This Week</h2>
              </div>
              <div className="space-y-3">
                {weekly.messages.slice(0, 5).map((msg) => (
                  <Card key={msg.id} data-testid={`memory-message-${msg.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">{msg.authorEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">{msg.authorName}</span>
                            <span className="text-xs text-muted-foreground">
                              to {msg.recipientName}
                            </span>
                            {msg.type === "rose" && <span className="text-xs">🌹</span>}
                            {msg.type === "thorn" && <span className="text-xs">🌵</span>}
                          </div>
                          <p className="text-sm font-medium">{msg.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {msg.content}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(msg.createdAt), "EEE")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {weekly.messages.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground">
                    +{weekly.messages.length - 5} more messages this week
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Events Summary */}
          {weekly.events.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Events This Week</h2>
              </div>
              <div className="space-y-2">
                {weekly.events.map((event) => (
                  <Card key={event.id} data-testid={`memory-event-${event.id}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="text-center min-w-[3rem]">
                        <p className="text-xs text-muted-foreground uppercase">
                          {format(parseISO(event.startDate), "EEE")}
                        </p>
                        <p className="text-lg font-bold">
                          {format(parseISO(event.startDate), "d")}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{event.title}</p>
                        {event.location && (
                          <p className="text-xs text-muted-foreground">{event.location}</p>
                        )}
                        {event.memberNames.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {event.memberNames.join(", ")}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Pulse Summary */}
          {weekly.pulses.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Thinking of You</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weekly.pulses.map((pulse, i) => (
                  <Card key={i} data-testid={`memory-pulse-${i}`}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl mb-2">{pulse.senderEmoji}</p>
                      <p className="text-sm">
                        <span className="font-semibold">{pulse.sender}</span>{" "}
                        thought of{" "}
                        <span className="font-semibold">{pulse.recipient}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pulse.count} {pulse.count === 1 ? "time" : "times"} this week 💛
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Empty state when nothing happened */}
          {weekly.photos.length === 0 &&
           weekly.messages.length === 0 &&
           weekly.events.length === 0 &&
           weekly.pulses.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">A quiet week</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  No activities recorded this week yet. Start sharing photos, messages,
                  and moments to see them beautifully compiled here.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Generated timestamp */}
          <p className="text-xs text-center text-muted-foreground pb-4">
            Generated {format(parseISO(weekly.generatedAt), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Unable to load weekly compilation.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
