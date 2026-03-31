import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Filter, Heart } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family, FamilyMember, Message } from "@shared/schema";

export default function Messages() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newMsg, setNewMsg] = useState({
    recipientId: "",
    title: "",
    content: "",
    type: "text",
  });

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  const createMessage = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDialogOpen(false);
      setNewMsg({ recipientId: "", title: "", content: "", type: "text" });
      toast({ title: "Message sent", description: "Your message has been delivered to the family." });
    },
  });

  const members = familyData?.members || [];
  const family = familyData?.family;

  const filteredMessages = (messages || []).filter((msg) => {
    if (filter === "all") return true;
    if (filter === "rose") return msg.type === "rose";
    if (filter === "thorn") return msg.type === "thorn";
    // Filter by member ID
    const memberId = parseInt(filter);
    if (!isNaN(memberId)) {
      return msg.authorId === memberId || msg.recipientId === memberId;
    }
    return true;
  });

  const handleSubmit = () => {
    if (!family || !newMsg.title || !newMsg.content) return;
    createMessage.mutate({
      familyId: family.id,
      authorId: members[0]?.id || 1, // Default to first member (Dad)
      recipientId: newMsg.recipientId === "everyone" || !newMsg.recipientId ? null : parseInt(newMsg.recipientId),
      title: newMsg.title,
      content: newMsg.content,
      type: newMsg.type,
    });
  };

  const typeBadge = (type: string) => {
    if (type === "rose")
      return (
        <Badge variant="secondary" className="text-[10px] rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 border-0">
          🌹 Rose
        </Badge>
      );
    if (type === "thorn")
      return (
        <Badge variant="secondary" className="text-[10px] rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0">
          🌵 Thorn
        </Badge>
      );
    return (
      <Badge variant="secondary" className="text-[10px] rounded-full border-0">
        💬 Text
      </Badge>
    );
  };

  const cardBg = (type: string) => {
    if (type === "rose") return "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/30";
    if (type === "thorn") return "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/30";
    return "";
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto page-enter" data-testid="messages-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Messages
        </h1>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36" data-testid="select-message-filter">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="rose">🌹 Roses</SelectItem>
              <SelectItem value="thorn">🌵 Thorns</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.emoji} {m.name.split(" ")[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-message">
                <Plus className="h-4 w-4 mr-1" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                  className="text-xl"
                >
                  New Message
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>To</Label>
                  <Select
                    value={newMsg.recipientId}
                    onValueChange={(v) => setNewMsg((p) => ({ ...p, recipientId: v }))}
                  >
                    <SelectTrigger data-testid="select-recipient">
                      <SelectValue placeholder="Choose recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.emoji} {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newMsg.title}
                    onChange={(e) => setNewMsg((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Message title"
                    data-testid="input-message-title"
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={newMsg.content}
                    onChange={(e) => setNewMsg((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Share something with your family..."
                    rows={5}
                    data-testid="input-message-content"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={newMsg.type}
                    onValueChange={(v) => setNewMsg((p) => ({ ...p, type: v }))}
                  >
                    <SelectTrigger data-testid="select-message-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">💬 Regular</SelectItem>
                      <SelectItem value="rose">🌹 Rose</SelectItem>
                      <SelectItem value="thorn">🌵 Thorn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={createMessage.isPending || !newMsg.title || !newMsg.content}
                  className="w-full"
                  data-testid="button-submit-message"
                >
                  {createMessage.isPending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filteredMessages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="h-12 w-12 mx-auto mb-4 text-rose-400" />
            <h3
              className="font-semibold text-xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              No messages yet
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Send your first rose to someone you love.
            </p>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-first-message">
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg) => {
            const author = members.find((m) => m.id === msg.authorId);
            const recipient = msg.recipientId
              ? members.find((m) => m.id === msg.recipientId)
              : null;
            const isExpanded = expandedId === msg.id;

            return (
              <Card
                key={msg.id}
                className={`cursor-pointer card-hover ${cardBg(msg.type)}`}
                onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                data-testid={`message-card-${msg.id}`}
              >
                <CardContent className="py-4 px-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-base shrink-0">
                      {author?.emoji || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-semibold text-sm"
                          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1rem" }}
                        >
                          {author?.name || "Unknown"}
                        </span>
                        {recipient && (
                          <span className="text-xs text-muted-foreground">
                            to{" "}
                            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                              {recipient.name.split(" ")[0]}
                            </span>
                          </span>
                        )}
                        {!recipient && msg.recipientId === null && (
                          <span className="text-xs text-muted-foreground">to Family</span>
                        )}
                        {typeBadge(msg.type)}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{msg.title}</p>
                      <p
                        className={`text-sm text-muted-foreground mt-1 ${
                          isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"
                        }`}
                      >
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
  );
}
