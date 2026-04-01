import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ensureCsrfToken } from "@/lib/queryClient";

interface OhanaMessage {
  id: string;
  role: "user" | "ohana";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What did we do last weekend?",
  "Generate a memory compilation",
  "Help me import photos",
  "Find memories of\u2026",
];

function OhanaConstellationSmall() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      style={{ color: "#C4944A" }}
    >
      <circle cx="14" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="7" cy="12" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="21" cy="12" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="9" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
      <circle cx="19" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
      <line x1="14" y1="6" x2="7" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="14" y1="6" x2="21" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="7" y1="12" x2="9" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="21" y1="12" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="9" y1="21" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-[#C4944A]/60"
              style={{
                animation: "askOhanaDot 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AskOhana() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<OhanaMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(() =>
    sessionStorage.getItem("ohana-conversation-id"),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Persist conversationId to sessionStorage
  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem("ohana-conversation-id", conversationId);
    }
  }, [conversationId]);

  // Auto-scroll to bottom on new messages or when loading
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      const userMsg: OhanaMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const token = await ensureCsrfToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["x-csrf-token"] = token;
        }

        const res = await fetch("/api/ohana/ask", {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: trimmed,
            conversationId,
          }),
          credentials: "include",
        });

        if (!res.ok) {
          const text = (await res.text()) || res.statusText;
          throw new Error(`${res.status}: ${text}`);
        }

        const data = await res.json();

        if (data.conversationId) {
          setConversationId(data.conversationId);
        }

        const ohanaMsg: OhanaMessage = {
          id: `ohana-${Date.now()}`,
          role: "ohana",
          content: data.response || data.message || "I'm not sure how to respond to that.",
        };
        setMessages((prev) => [...prev, ohanaMsg]);
      } catch (err: any) {
        toast({
          title: "Couldn't reach Ohana",
          description: err.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, isLoading, toast],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  };

  return (
    <>
      {/* Keyframe styles for typing dots */}
      <style>{`
        @keyframes askOhanaDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes askOhanaSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes askOhanaFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-[#C4944A] text-white hover:scale-105 shadow-lg hover:shadow-[0_4px_20px_rgba(196,148,74,0.4)]"
        }`}
        aria-label={isOpen ? "Close Ohana chat" : "Ask Ohana"}
        data-testid="button-ask-ohana"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 h-[520px] rounded-2xl bg-card border border-amber-200/50 dark:border-amber-800/30 shadow-xl flex flex-col overflow-hidden"
          style={{ animation: "askOhanaSlideUp 0.25s ease-out" }}
          data-testid="panel-ask-ohana"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200/40 dark:border-amber-800/20 bg-card">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "#C4944A" }} />
              <div>
                <h2
                  className="text-lg font-semibold leading-none"
                  style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', Georgia, serif)", color: "#C4944A" }}
                >
                  Ohana
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Your family's AI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
              aria-label="Close panel"
              data-testid="button-close-ohana"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && !isLoading ? (
              /* Empty state */
              <div
                className="flex flex-col items-center justify-center h-full text-center"
                style={{ animation: "askOhanaFadeIn 0.3s ease-out" }}
              >
                <OhanaConstellationSmall />
                <p
                  className="text-base font-semibold mt-3 mb-4"
                  style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', Georgia, serif)" }}
                >
                  Ask me anything about your family
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-xs px-3 py-1.5 rounded-full border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition-colors"
                      data-testid="chip-suggested-prompt"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    style={{ animation: "askOhanaFadeIn 0.2s ease-out" }}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-amber-50 dark:bg-amber-950/30 rounded-tl-sm"
                      }`}
                      style={
                        msg.role === "ohana"
                          ? { fontFamily: "var(--font-display, 'Cormorant Garamond', Georgia, serif)", fontSize: "0.9rem" }
                          : undefined
                      }
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 py-2.5 border-t border-amber-200/40 dark:border-amber-800/20 bg-card">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask Ohana..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none rounded-full border border-border/70 bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ maxHeight: "96px" }}
                data-testid="input-ask-ohana"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="rounded-full shrink-0 h-9 w-9 p-0 bg-[#C4944A] hover:bg-[#B08340] text-white"
                aria-label="Send message"
                data-testid="button-send-ohana"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
