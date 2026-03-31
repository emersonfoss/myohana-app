import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Camera, MessageCircle, Calendar, Heart,
  Search, ChevronRight, BookOpen, Clock, Users, Filter,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family, FamilyMember, MemoryAtom, MemoryCompilation } from "@shared/schema";

type Tab = "timeline" | "compilations" | "on-this-day" | "personal-lens";

const categoryLabels: Record<string, string> = {
  daily_life: "Daily Life",
  milestone: "Milestone",
  celebration: "Celebration",
  family_time: "Family Time",
  school: "School",
  travel: "Travel",
  holiday: "Holiday",
  tender_moment: "Tender Moment",
  funny: "Funny",
  creative: "Creative",
};

const categoryColors: Record<string, string> = {
  daily_life: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  milestone: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  celebration: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  family_time: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  school: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  travel: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  holiday: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  tender_moment: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  funny: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  creative: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
};

const sourceIcons: Record<string, typeof Camera> = {
  photo: Camera,
  message: MessageCircle,
  event: Calendar,
  pulse: Heart,
  chat: MessageCircle,
};

// ─── Memory Atom Card ───────────────────────────────────────────────

function MemoryAtomCard({ atom, members }: { atom: MemoryAtom; members: FamilyMember[] }) {
  const meta = atom.metadata ? JSON.parse(atom.metadata) : {};
  const Icon = sourceIcons[atom.sourceType] || Sparkles;
  const memberIds: number[] = atom.memberIds ? JSON.parse(atom.memberIds) : [];
  const involvedMembers = memberIds
    .map(id => members.find(m => m.id === id))
    .filter(Boolean) as FamilyMember[];

  const timeAgo = formatDistanceToNow(parseISO(atom.occurredAt), { addSuffix: true });
  const dateStr = format(parseISO(atom.occurredAt), "MMM d, yyyy");

  return (
    <Card
      className="card-hover border-amber-100/50 dark:border-amber-900/20 shadow-[0_2px_10px_rgba(180,120,60,0.06)] hover:shadow-[0_3px_16px_rgba(180,120,60,0.12)] transition-all duration-300"
      data-testid={`memory-atom-${atom.id}`}
    >
      <CardContent className="p-5">
        <div className="flex gap-4">
          {/* Source icon */}
          <div className="shrink-0 mt-0.5">
            {atom.sourceType === "photo" && meta.photoUrl ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden">
                <img src={meta.photoUrl} alt={atom.title} className="w-full h-full object-cover" />
              </div>
            ) : atom.sourceType === "pulse" ? (
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <Heart className="h-5 w-5 text-rose-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <Icon className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-semibold leading-snug">{atom.title}</p>
              <Badge
                variant="secondary"
                className={`text-[10px] shrink-0 rounded-full ${categoryColors[atom.category] || ""}`}
              >
                {categoryLabels[atom.category] || atom.category}
              </Badge>
            </div>

            {atom.description && atom.sourceType !== "pulse" && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {atom.description}
              </p>
            )}
            {atom.sourceType === "pulse" && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                {atom.description}
              </p>
            )}

            {/* Message quote */}
            {atom.sourceType === "message" && meta.content && (
              <div className="mt-2 pl-3 border-l-2 border-amber-300/50">
                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                  "{(meta.content as string).substring(0, 120)}..."
                </p>
              </div>
            )}

            {/* Footer: members + time */}
            <div className="flex items-center gap-2 mt-3">
              {involvedMembers.slice(0, 4).map(m => (
                <span key={m.id} className="text-xs" title={m.name}>
                  {m.emoji}
                </span>
              ))}
              <span className="text-[11px] text-muted-foreground ml-auto" title={dateStr}>
                {timeAgo}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Timeline Tab ───────────────────────────────────────────────────

function TimelineTab({ members }: { members: FamilyMember[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [memberId, setMemberId] = useState<string>("all");

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", "20");
  if (category !== "all") queryParams.set("category", category);
  if (memberId !== "all") queryParams.set("memberId", memberId);

  const { data: atoms, isLoading } = useQuery<MemoryAtom[]>({
    queryKey: ["/api/memories/timeline", page, category, memberId],
    queryFn: async () => {
      const res = await fetch(`/api/memories/timeline?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: searchResults } = useQuery<MemoryAtom[]>({
    queryKey: ["/api/memories/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const res = await fetch(`/api/memories/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: searchQuery.length > 0,
  });

  const handleSearch = useCallback(() => {
    setSearchQuery(search);
  }, [search]);

  const displayAtoms = searchQuery ? searchResults || [] : atoms || [];

  // Group atoms by date
  const grouped = new Map<string, MemoryAtom[]>();
  for (const atom of displayAtoms) {
    const dateKey = format(parseISO(atom.occurredAt), "yyyy-MM-dd");
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(atom);
  }

  return (
    <div className="space-y-5">
      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search your memories..."
              className="pl-9"
              data-testid="input-memory-search"
            />
          </div>
          <Button size="icon" variant="outline" onClick={handleSearch} data-testid="button-memory-search">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={category} onValueChange={v => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="select-category-filter">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={memberId} onValueChange={v => { setMemberId(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]" data-testid="select-member-filter">
              <Users className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>{m.emoji} {m.name.split(" ")[0]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Atom feed grouped by date — journal entry style */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : displayAtoms.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-4 text-amber-300" />
            <h3
              className="font-semibold text-xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {searchQuery ? "No memories found" : "Your story starts here"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search.`
                : "Share photos, messages, and moments — they'll become beautiful entries in your family's journal."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {[...grouped.entries()].map(([dateKey, dateAtoms]) => (
            <div key={dateKey} className="space-y-3">
              {/* Date divider — journal style */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-amber-200/50 dark:bg-amber-800/30" />
                <span
                  className="text-xs font-medium text-amber-700 dark:text-amber-400 px-3 py-0.5 rounded-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/30"
                >
                  {format(parseISO(dateKey), "EEEE, MMMM d, yyyy")}
                </span>
                <div className="h-px flex-1 bg-amber-200/50 dark:bg-amber-800/30" />
              </div>
              {dateAtoms.map(atom => (
                <MemoryAtomCard key={atom.id} atom={atom} members={members} />
              ))}
            </div>
          ))}

          {/* Pagination */}
          {!searchQuery && (atoms?.length || 0) >= 20 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground self-center">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Compilations Tab ───────────────────────────────────────────────

function CompilationsTab({ members }: { members: FamilyMember[] }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: compilations, isLoading } = useQuery<MemoryCompilation[]>({
    queryKey: ["/api/memories/compilations"],
  });

  const { data: selectedCompilation } = useQuery<MemoryCompilation & { atoms: MemoryAtom[] }>({
    queryKey: ["/api/memories/compilations", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/memories/compilations/${selectedId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: selectedId !== null,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const res = await apiRequest("POST", "/api/memories/compilations/generate", {
        type: "weekly",
        startDate: weekStart.toISOString(),
        endDate: now.toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memories/compilations"] });
      toast({ title: "Compilation Generated", description: "A new weekly compilation has been created." });
    },
  });

  if (selectedId && selectedCompilation) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(null)}
          data-testid="button-back-compilations"
        >
          &larr; Back to Compilations
        </Button>

        {/* Compilation detail view — magazine style */}
        <div className="text-center space-y-2 pt-4">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {selectedCompilation.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(selectedCompilation.periodStart), "MMM d")} — {format(parseISO(selectedCompilation.periodEnd), "MMM d, yyyy")}
          </p>
        </div>

        {/* Narrative */}
        {selectedCompilation.narrative && (
          <Card className="bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30">
            <CardContent className="p-6">
              <p
                className="text-base leading-relaxed italic text-foreground"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.1rem" }}
              >
                {selectedCompilation.narrative}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Atoms in this compilation */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {selectedCompilation.atoms?.length || 0} Moments
          </h3>
          {(selectedCompilation.atoms || []).map(atom => (
            <MemoryAtomCard key={atom.id} atom={atom} members={members} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Your Compilations
        </h3>
        <Button
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-compilation"
        >
          <BookOpen className="h-4 w-4 mr-1" />
          {generateMutation.isPending ? "Generating..." : "Generate Weekly"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !compilations || compilations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-4 text-amber-300" />
            <h3
              className="font-semibold text-xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              No compilations yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
              Compilations are beautifully narrated summaries of your family's memories — like a letter from your year.
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-first-compilation"
            >
              Generate Your First Compilation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {compilations.map(comp => {
            const atomCount = comp.atomIds ? JSON.parse(comp.atomIds).length : 0;
            return (
              <Card
                key={comp.id}
                className="card-hover cursor-pointer border-amber-100/50 dark:border-amber-900/20"
                onClick={() => setSelectedId(comp.id)}
                data-testid={`compilation-${comp.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px] rounded-full capitalize">
                          {comp.type}
                        </Badge>
                      </div>
                      <p
                        className="text-base font-semibold leading-tight"
                        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                      >
                        {comp.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {atomCount} {atomCount === 1 ? "moment" : "moments"} &middot;{" "}
                        {format(parseISO(comp.generatedAt), "MMM d, yyyy")}
                      </p>
                      {comp.narrative && (
                        <p
                          className="text-xs text-muted-foreground mt-2 line-clamp-2 italic"
                          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "0.85rem" }}
                        >
                          {comp.narrative.substring(0, 120)}...
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── On This Day Tab ────────────────────────────────────────────────

function OnThisDayTab({ members }: { members: FamilyMember[] }) {
  const { data: atoms, isLoading } = useQuery<MemoryAtom[]>({
    queryKey: ["/api/memories/on-this-day"],
  });

  const todayStr = format(new Date(), "MMMM d");

  return (
    <div className="space-y-6">
      <div className="text-center py-5">
        <Clock className="h-8 w-8 mx-auto text-amber-400 mb-3" />
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          On This Day — {todayStr}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          What happened on this date in previous years
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !atoms || atoms.length === 0 ? (
        <Card className="bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="py-12 text-center">
            <p
              className="text-xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Nothing yet for this day
            </p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your first memories will appear here next year. Keep creating moments — they'll become beautiful reminders of where you've been.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {atoms.map(atom => {
            const year = new Date(atom.occurredAt).getFullYear();
            return (
              <div
                key={atom.id}
                className="rounded-xl border border-amber-200/40 dark:border-amber-800/20 bg-amber-50/30 dark:bg-amber-950/10 p-1"
              >
                <p
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 px-3 pt-2"
                >
                  {year}
                </p>
                <MemoryAtomCard atom={atom} members={members} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Personal Lens Tab ──────────────────────────────────────────────

function PersonalLensTab({ members }: { members: FamilyMember[] }) {
  const [memberA, setMemberA] = useState<string>("");
  const [memberB, setMemberB] = useState<string>("");

  const bothSelected = memberA && memberB && memberA !== memberB;

  const { data: atoms, isLoading } = useQuery<MemoryAtom[]>({
    queryKey: ["/api/memories/timeline", "lens", memberA, memberB],
    queryFn: async () => {
      const res = await fetch(`/api/memories/timeline?memberIds=${memberA},${memberB}&limit=100`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!bothSelected,
  });

  const nameA = members.find(m => m.id === Number(memberA));
  const nameB = members.find(m => m.id === Number(memberB));

  return (
    <div className="space-y-6">
      <div className="text-center py-5">
        <Users className="h-8 w-8 mx-auto text-amber-400 mb-3" />
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Personal Lens
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Explore memories between two family members
        </p>
      </div>

      {/* Member selectors */}
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <Select value={memberA} onValueChange={setMemberA}>
          <SelectTrigger className="w-[160px]" data-testid="select-lens-member-a">
            <SelectValue placeholder="First member..." />
          </SelectTrigger>
          <SelectContent>
            {members.map(m => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.emoji} {m.name.split(" ")[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">&amp;</span>
        <Select value={memberB} onValueChange={setMemberB}>
          <SelectTrigger className="w-[160px]" data-testid="select-lens-member-b">
            <SelectValue placeholder="Second member..." />
          </SelectTrigger>
          <SelectContent>
            {members.filter(m => String(m.id) !== memberA).map(m => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.emoji} {m.name.split(" ")[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {bothSelected && (
        <div className="text-center">
          <p
            className="font-semibold text-base"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {nameA?.emoji} {nameA?.name.split(" ")[0]} &amp; {nameB?.emoji} {nameB?.name.split(" ")[0]}
            {atoms && atoms.length > 0
              ? ` — ${atoms.length} ${atoms.length === 1 ? "Memory" : "Memories"} Together`
              : ""}
          </p>
        </div>
      )}

      {bothSelected && isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : bothSelected && (!atoms || atoms.length === 0) ? (
        <Card className="bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Start creating memories together
            </p>
          </CardContent>
        </Card>
      ) : bothSelected && atoms ? (
        <div className="space-y-3">
          {atoms.map(atom => (
            <MemoryAtomCard key={atom.id} atom={atom} members={members} />
          ))}
        </div>
      ) : null}

      {!bothSelected && (
        <Card className="bg-muted/50">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Select two family members above to see their shared memories.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function Memories() {
  const [tab, setTab] = useState<Tab>("timeline");
  const { toast } = useToast();

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: stats } = useQuery<{
    totalAtoms: number;
    byCategory: Record<string, number>;
    byMember: Record<number, number>;
    bySourceType: Record<string, number>;
    growingSince: string;
  }>({
    queryKey: ["/api/memories/stats"],
  });

  const members = familyData?.members || [];
  const family = familyData?.family;

  // Auto-ingest on first visit if no atoms exist
  const ingestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/memories/ingest-all");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.ingested > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/memories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/memories/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/memories/timeline"] });
      }
    },
  });

  useEffect(() => {
    if (stats && stats.totalAtoms === 0 && !ingestMutation.isPending) {
      ingestMutation.mutate();
    }
  }, [stats?.totalAtoms]);

  const photoCount = stats?.bySourceType?.photo || 0;
  const messageCount = stats?.bySourceType?.message || 0;
  const growingSince = stats?.growingSince
    ? format(parseISO(stats.growingSince), "MMMM yyyy")
    : "now";

  const tabs: { key: Tab; label: string }[] = [
    { key: "timeline", label: "Timeline" },
    { key: "compilations", label: "Compilations" },
    { key: "on-this-day", label: "On This Day" },
    { key: "personal-lens", label: "Personal Lens" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto page-enter" data-testid="memories-page">
      {/* Hero */}
      <div className="text-center pt-4 pb-2">
        <Sparkles className="h-8 w-8 mx-auto text-amber-400 mb-3" />
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Family Memories
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Every laugh, every message, every quiet moment of love — beautifully preserved for the{" "}
          {family?.name || "family"}.
        </p>
      </div>

      {/* Stats bar */}
      {stats && stats.totalAtoms > 0 && (
        <div
          className="flex items-center justify-center gap-3 text-xs text-muted-foreground flex-wrap py-2 px-4 rounded-full bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/20 mx-auto w-fit"
          data-testid="memory-stats-bar"
        >
          <span className="font-semibold text-amber-700 dark:text-amber-400">{stats.totalAtoms} memories</span>
          <span className="text-amber-300 dark:text-amber-700">&middot;</span>
          <span>{photoCount} photos</span>
          <span className="text-amber-300 dark:text-amber-700">&middot;</span>
          <span>{messageCount} messages</span>
          <span className="text-amber-300 dark:text-amber-700">&middot;</span>
          <span>Growing since {growingSince}</span>
        </div>
      )}

      {/* Tab navigation — warm gold underline style */}
      <div className="flex gap-1 border-b border-amber-200/40 dark:border-amber-800/30 overflow-x-auto pb-px">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? "border-amber-500 text-amber-700 dark:text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-amber-300/50"
            }`}
            data-testid={`tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "timeline" && <TimelineTab members={members} />}
      {tab === "compilations" && <CompilationsTab members={members} />}
      {tab === "on-this-day" && <OnThisDayTab members={members} />}
      {tab === "personal-lens" && <PersonalLensTab members={members} />}
    </div>
  );
}
