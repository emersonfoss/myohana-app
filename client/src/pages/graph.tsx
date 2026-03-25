import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface GraphContext {
  family: { name: string; memberCount: number; createdAt: string };
  members: Array<{
    id: number;
    name: string;
    role: string;
    age: number | null;
    emoji: string;
    description: string | null;
    recentActivity: {
      messagesSent: number;
      pulsesSent: number;
      lastActive: string | null;
    };
  }>;
  recentMessages: Array<{
    from: string;
    to: string;
    title: string;
    type: string;
    date: string;
  }>;
  upcomingEvents: Array<{
    title: string;
    date: string;
    members: string[];
  }>;
  vaultSummary: {
    totalDocuments: number;
    expiringWithin30Days: string[];
    categories: Record<string, number>;
  };
  mediaRoom: {
    totalApproved: number;
    recentlyAdded: Array<{ title: string; type: string }>;
  };
  emotionalPulse: {
    pulsesThisWeek: number;
    mostConnected: string | null;
    quietMembers: string[];
  };
  generatedAt: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard might not be available in iframe
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleCopy}
      data-testid="button-copy-endpoint"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

function FamilyNode({
  member,
  index,
  total,
}: {
  member: GraphContext["members"][0];
  index: number;
  total: number;
}) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const radius = 38;
  const x = 50 + radius * Math.cos(angle);
  const y = 50 + radius * Math.sin(angle);

  return (
    <g>
      {/* Line to center */}
      <line
        x1="50%"
        y1="50%"
        x2={`${x}%`}
        y2={`${y}%`}
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.15"
        className="text-foreground"
      />
      {/* Member dot */}
      <foreignObject
        x={`${x - 5}%`}
        y={`${y - 5}%`}
        width="10%"
        height="10%"
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-lg shadow-sm">
            {member.emoji}
          </div>
          <span className="text-[10px] font-medium mt-0.5 text-foreground whitespace-nowrap">
            {member.name.split(" ")[0]}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

function GraphVisualization({
  members,
  familyName,
}: {
  members: GraphContext["members"];
  familyName: string;
}) {
  return (
    <div
      className="relative w-full aspect-square max-w-md mx-auto"
      data-testid="graph-visualization"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Ambient rings */}
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.08"
          className="text-primary"
        />
        <circle
          cx="50"
          cy="50"
          r="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.06"
          className="text-primary"
        />

        {/* Member nodes with lines */}
        {members.map((m, i) => (
          <FamilyNode key={m.id} member={m} index={i} total={members.length} />
        ))}

        {/* Center family node */}
        <foreignObject x="38%" y="38%" width="24%" height="24%">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center shadow-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[9px] font-semibold text-primary mt-0.5 whitespace-nowrap">
              {familyName.replace("The ", "").replace(" Family", "")}
            </span>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

const endpoints = [
  {
    method: "GET",
    path: "/api/graph/context",
    description: "Complete family context — the single endpoint that makes AI family-aware",
  },
  {
    method: "GET",
    path: "/api/graph/member/:id",
    description: "Detailed context for a specific family member",
  },
  {
    method: "GET",
    path: "/api/graph/query?q=...",
    description: "Natural language query — keyword-matched to family data",
  },
  {
    method: "GET",
    path: "/api/graph/schema",
    description: "Schema description of all entities and relationships",
  },
  {
    method: "GET",
    path: "/api/graph/mcp-manifest",
    description: "MCP-compatible tool manifest for AI platform integration",
  },
];

export default function GraphPage() {
  const { data: graphData, isLoading } = useQuery<GraphContext>({
    queryKey: ["/api/graph/context"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full max-w-md mx-auto" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const members = graphData?.members || [];
  const familyName = graphData?.family.name || "Family";

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-5xl mx-auto page-enter" data-testid="graph-page">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-graph-title">
              The Family Graph
            </h1>
            <p className="text-sm text-muted-foreground">
              Your family's context layer for AI platforms
            </p>
          </div>
        </div>
      </div>

      {/* Graph Visualization */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <GraphVisualization members={members} familyName={familyName} />
          <p className="text-center text-xs text-muted-foreground mt-2">
            {members.length} members connected through the Family Graph
          </p>
        </CardContent>
      </Card>

      {/* Member Stats Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Member Activity
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.id} className="card-hover" data-testid={`graph-member-${member.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{member.emoji}</span>
                  <span className="font-medium text-sm">{member.name.split(" ")[0]}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {member.role}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Messages: {member.recentActivity.messagesSent}</span>
                  <span>Pulses: {member.recentActivity.pulsesSent}</span>
                  {member.age !== null && <span>Age: {member.age}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Graph Insights */}
      {graphData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vault</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {graphData.vaultSummary.totalDocuments}
              </p>
              <p className="text-xs text-muted-foreground">
                documents stored
              </p>
              {graphData.vaultSummary.expiringWithin30Days.length > 0 && (
                <p className="text-xs text-amber-500 mt-1">
                  {graphData.vaultSummary.expiringWithin30Days.length} expiring
                  soon
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Emotional Pulse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {graphData.emotionalPulse.pulsesThisWeek}
              </p>
              <p className="text-xs text-muted-foreground">
                pulses this week
              </p>
              {graphData.emotionalPulse.mostConnected && (
                <p className="text-xs text-primary mt-1">
                  Most connected: {graphData.emotionalPulse.mostConnected}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Media Room</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {graphData.mediaRoom.totalApproved}
              </p>
              <p className="text-xs text-muted-foreground">
                approved items
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Endpoints */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          API Endpoints
        </h2>
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <Card key={ep.path} data-testid={`endpoint-${ep.path.split("/").pop()}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono shrink-0"
                  >
                    {ep.method}
                  </Badge>
                  <code className="text-xs font-mono text-primary truncate">
                    {ep.path}
                  </code>
                  <CopyButton text={ep.path} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {ep.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* For AI Platforms */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            For AI Platforms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            The Family Graph exposes structured family context that any AI agent
            can consume. Instead of asking "who is in the family?" every time, an
            AI platform queries <code className="text-primary">/api/graph/context</code>{" "}
            and instantly understands ages, roles, schedules, preferences, and
            emotional signals.
          </p>
          <div className="bg-background rounded-lg p-3 border">
            <p className="text-xs font-semibold mb-1">Quick Start</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                Fetch <code className="text-primary">/api/graph/mcp-manifest</code> to
                discover available tools
              </li>
              <li>
                Call <code className="text-primary">/api/graph/context</code> for the
                complete family picture
              </li>
              <li>
                Use <code className="text-primary">/api/graph/query?q=...</code> for
                natural language lookups
              </li>
              <li>
                Drill into <code className="text-primary">/api/graph/member/:id</code> for
                per-member detail
              </li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground italic">
            The vision: every AI that touches your family life — from a smart
            speaker to a homework helper — pulls from the same warm, trusted
            family context. No cold starts. No re-explaining. Just ohana.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
