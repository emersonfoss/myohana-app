import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Navigation } from "lucide-react";
import { formatDistanceToNow, parseISO, differenceInMinutes } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Family, FamilyMember, Location } from "@shared/schema";

function getStatusDot(updatedAt: string) {
  const mins = differenceInMinutes(new Date(), parseISO(updatedAt));
  if (mins < 30) return { color: "bg-green-500", label: "Active" };
  if (mins < 120) return { color: "bg-yellow-500", label: "Recent" };
  return { color: "bg-gray-400", label: "Inactive" };
}

function MiniMap({ locations, members }: { locations: Location[]; members: FamilyMember[] }) {
  if (locations.length === 0) return null;

  const lats = locations.map((l) => parseFloat(l.latitude));
  const lngs = locations.map((l) => parseFloat(l.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const padLat = Math.max((maxLat - minLat) * 0.3, 0.005);
  const padLng = Math.max((maxLng - minLng) * 0.3, 0.005);

  const rangeX = (maxLng - minLng + padLng * 2) || 0.01;
  const rangeY = (maxLat - minLat + padLat * 2) || 0.01;

  const toX = (lng: number) => ((lng - minLng + padLng) / rangeX) * 100;
  const toY = (lat: number) => (1 - (lat - minLat + padLat) / rangeY) * 100;

  // Cluster nearby members (within ~2% of map space)
  const positioned: { x: number; y: number; members: { emoji: string; name: string }[] }[] = [];
  for (const loc of locations) {
    const member = members.find((m) => m.id === loc.memberId);
    if (!member) continue;
    const x = toX(parseFloat(loc.longitude));
    const y = toY(parseFloat(loc.latitude));
    const nearby = positioned.find((p) => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 4);
    if (nearby) {
      nearby.members.push({ emoji: member.emoji, name: member.name });
    } else {
      positioned.push({ x, y, members: [{ emoji: member.emoji, name: member.name }] });
    }
  }

  return (
    <div className="relative w-full h-48 rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-accent/10 border border-primary/10 overflow-hidden">
      {/* Subtle grid lines */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: "linear-gradient(0deg, currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
        backgroundSize: "25% 25%"
      }} />
      {/* Positioned member dots */}
      {positioned.map((cluster, i) => (
        <div
          key={i}
          className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: `${Math.max(8, Math.min(92, cluster.x))}%`, top: `${Math.max(8, Math.min(92, cluster.y))}%` }}
        >
          <div className="flex items-center gap-0.5">
            {cluster.members.map((m, j) => (
              <span key={j} className="text-lg drop-shadow-sm" title={m.name}>
                {m.emoji}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-medium text-muted-foreground mt-0.5 bg-background/70 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {cluster.members.map((m) => m.name.split(" ")[0]).join(", ")}
          </span>
        </div>
      ))}
      {/* Corner label */}
      <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/50 italic">Family Pulse Map</span>
    </div>
  );
}

export default function Pulse() {
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: locations, isLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const updateLocation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/locations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setSharing(false);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    },
    onError: () => {
      setSharing(false);
    },
  });

  const family = familyData?.family;
  const members = familyData?.members || [];
  const allLocations = locations || [];

  const handleShareLocation = () => {
    if (!family || !navigator.geolocation) return;
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation.mutate({
          familyId: family.id,
          memberId: members[0]?.id || 1,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
          address: null,
        });
      },
      () => {
        setSharing(false);
      }
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-2xl mx-auto page-enter" data-testid="pulse-page">
      {/* Header with heartbeat animation */}
      <div className="text-center pt-4">
        <div className="relative inline-block">
          <MapPin className="h-8 w-8 mx-auto text-primary mb-3 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
        </div>
        <h1 className="text-xl font-bold">Family Pulse</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everyone's safe. Everyone's where they should be.
        </p>
      </div>

      {/* Abstract mini map */}
      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <MiniMap locations={allLocations} members={members} />
      )}

      {/* Share My Location button */}
      <div className="flex justify-center">
        <Button
          onClick={handleShareLocation}
          disabled={sharing || !family}
          className={`gap-2 transition-all ${shared ? "bg-green-600 hover:bg-green-600" : ""}`}
          data-testid="button-share-location"
        >
          {sharing ? (
            <>
              <Navigation className="h-4 w-4 animate-spin" />
              Locating...
            </>
          ) : shared ? (
            <>
              <MapPin className="h-4 w-4" />
              Location Shared!
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4" />
              Share My Location
            </>
          )}
        </Button>
      </div>

      {/* Member location cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-center">
          Family Members
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : members.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">No family members found.</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const loc = allLocations.find((l) => l.memberId === member.id);
              const status = loc ? getStatusDot(loc.updatedAt) : null;

              return (
                <Card key={member.id} className="overflow-hidden card-hover" data-testid={`location-member-${member.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Emoji avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                      {member.emoji}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{member.name.split(" ")[0]}</span>
                        {status && (
                          <span className={`w-2 h-2 rounded-full ${status.color} shrink-0`} title={status.label} />
                        )}
                      </div>
                      {loc ? (
                        <>
                          <p className="text-sm text-muted-foreground truncate">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {loc.address || `${parseFloat(loc.latitude).toFixed(4)}, ${parseFloat(loc.longitude).toFixed(4)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last seen: {formatDistanceToNow(parseISO(loc.updatedAt), { addSuffix: true })}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No location shared yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
