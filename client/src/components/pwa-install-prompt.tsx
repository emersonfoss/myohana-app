import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Share, Plus, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return; // Don't show if already installed

    // Detect iOS
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Check if dismissed recently
    const dismissed = sessionStorage.getItem?.("pwa-dismissed");
    if (dismissed) return;

    // Listen for the native install prompt (Chrome/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // On iOS, show the manual instructions after a short delay
    if (ios) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      sessionStorage.setItem("pwa-dismissed", "true");
    } catch {
      // sessionStorage may be blocked in some contexts
    }
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-bottom-4 duration-500"
      data-testid="pwa-install-prompt"
    >
      <div className="rounded-xl border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Add MyOhana to Home Screen</p>
            {isIOS ? (
              <p className="text-xs text-muted-foreground mt-1">
                Tap{" "}
                <Share className="inline h-3 w-3 -mt-0.5" />{" "}
                then <strong>"Add to Home Screen"</strong>{" "}
                <Plus className="inline h-3 w-3 -mt-0.5" /> for the full app
                experience.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Get quick access from your home screen. Works offline too.
              </p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
            data-testid="button-dismiss-pwa"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {!isIOS && deferredPrompt && (
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={handleInstall}
            data-testid="button-install-pwa"
          >
            Install MyOhana
          </Button>
        )}
      </div>
    </div>
  );
}
