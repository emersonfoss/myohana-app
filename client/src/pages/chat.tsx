import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageSquare, Smartphone, MessageCircle as WhatsAppIcon, Phone } from "lucide-react";
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
        <h1 className="text-xl font-bold">Chat Bridge</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your family conversations, all in one place
        </p>
      </div>

      {/* Connection banner */}
      <div className="px-4 sm:px-6 pb-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 px-4">
            <p className="text-sm text-muted-foreground">
              Connect your messaging apps to bring all family conversations here.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                <Smartphone className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium">iMessage</span>
                <Badge variant="secondary" className="text-[10px]" data-testid="badge-imessage">Coming Soon</Badge>
              </div>
              <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                <WhatsAppIcon className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium">WhatsApp</span>
                <Badge variant="secondary" className="text-[10px]" data-testid="badge-whatsapp">Coming Soon</Badge>
              </div>
              <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                <Phone className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium">SMS</span>
                <Badge variant="secondary" className="text-[10px]" data-testid="badge-sms">Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 space-y-2 min-h-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-3/4" />
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="h-12 w-12 mb-4 empty-state-icon" />
            <h3 className="font-semibold text-lg mb-1">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Start a conversation or connect a messaging app.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex flex-col" data-testid={`chat-message-${msg.id}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold">{msg.senderName}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${platformColors[msg.platform] || ""}`}
                  data-testid={`badge-platform-${msg.id}`}
                >
                  {platformLabels[msg.platform] || msg.platform}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {format(parseISO(msg.createdAt), "h:mm a")}
                </span>
              </div>
              <p className="text-sm pl-0.5">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send input */}
      <div className="p-4 sm:px-6 border-t">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sendMessage.isPending}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={sendMessage.isPending || !message.trim()}
            data-testid="button-send-chat"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
