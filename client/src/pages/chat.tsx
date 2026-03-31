import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessagesSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import type { ChatMessage } from "@shared/schema";

const platformColors: Record<string, string> = {
  internal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  whatsapp: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  imessage: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  sms: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const platformLabels: Record<string, string> = {
  internal: "Internal",
  whatsapp: "WhatsApp",
  imessage: "iMessage",
  sms: "SMS",
};

// Warm colors cycling per sender name
const senderColors = [
  "text-amber-700 dark:text-amber-400",
  "text-rose-600 dark:text-rose-400",
  "text-teal-700 dark:text-teal-400",
  "text-violet-700 dark:text-violet-400",
  "text-orange-700 dark:text-orange-400",
];

function getSenderColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return senderColors[Math.abs(hash) % senderColors.length];
}

export default function Chat() {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"],
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
      setMessage("");
    },
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto page-enter" data-testid="chat-page">
      {/* Header */}
      <div className="p-4 sm:p-6 pb-2">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Family Chat
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your private family space
        </p>
      </div>

      {/* Internal chat banner */}
      <div className="px-4 sm:px-6 pb-3">
        <div className="py-2 px-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            💬 Family chat — messages stay within your MyOhana hub.
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 space-y-3 min-h-0 py-2">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-3/4" />
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessagesSquare className="h-12 w-12 mb-4 text-amber-300" />
            <h3
              className="font-semibold text-xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Start the conversation
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Start chatting with your family. This is your private space.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isInternal = msg.platform === "internal";
            // Treat internal messages as "own" for right-align demo; others left-aligned
            const isOwn = isInternal;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                data-testid={`chat-message-${msg.id}`}
              >
                <div className={`flex items-center gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                  <span
                    className={`text-xs font-semibold ${getSenderColor(msg.senderName)}`}
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "0.9rem" }}
                  >
                    {msg.senderName}
                  </span>
                  {msg.platform !== "internal" && (
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 rounded-full ${platformColors[msg.platform] || ""}`}
                      data-testid={`badge-platform-${msg.id}`}
                    >
                      {platformLabels[msg.platform] || msg.platform}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {format(parseISO(msg.createdAt), "h:mm a")}
                  </span>
                </div>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border/60 dark:bg-card rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send input */}
      <div className="p-4 sm:px-6 border-t bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something to your family..."
            disabled={sendMessage.isPending}
            className="rounded-full border-border/70 focus-visible:ring-amber-300/60"
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={sendMessage.isPending || !message.trim()}
            className="rounded-full shrink-0"
            data-testid="button-send-chat"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
