import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const features = [
  "Unlimited family messages & roses",
  "Secure document vault",
  "Photo gallery & memories",
  "Family calendar & events",
  "Thinking-of-you pulses",
  "Family Pulse location sharing",
  "Weekly memory compilations",
];

interface AppConfig {
  stripePublishableKey: string | null;
  billingEnabled: boolean;
}

export function Paywall() {
  const { data: appConfig } = useQuery<AppConfig>({
    queryKey: ["/api/config"],
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/subscribe", { plan: "family" });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
  });

  const billingEnabled = appConfig?.billingEnabled ?? false;

  return (
    <Card className="max-w-md mx-auto border-primary/20" data-testid="paywall-card">
      <CardContent className="pt-6 text-center space-y-5">
        <div>
          <svg width="48" height="48" viewBox="0 0 28 28" fill="none" className="text-primary mx-auto mb-3">
            <circle cx="14" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="7" cy="12" r="2" fill="currentColor" opacity="0.7" />
            <circle cx="21" cy="12" r="2" fill="currentColor" opacity="0.7" />
            <circle cx="9" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
            <circle cx="19" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
            <line x1="14" y1="6" x2="7" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <line x1="14" y1="6" x2="21" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <line x1="7" y1="12" x2="9" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <line x1="21" y1="12" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <line x1="9" y1="21" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
          </svg>
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Upgrade to MyOhana Family
          </h2>
          <p className="text-primary font-semibold text-lg mt-1">
            $19.99/month
          </p>
          <p className="text-sm text-muted-foreground">
            One family. Everyone included.
          </p>
        </div>

        <ul className="text-left space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {billingEnabled ? (
          <Button
            className="w-full"
            size="lg"
            onClick={() => subscribeMutation.mutate()}
            disabled={subscribeMutation.isPending}
            data-testid="button-paywall-subscribe"
          >
            {subscribeMutation.isPending ? "Redirecting to checkout..." : "Start Your Family Hub"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Billing coming soon — Stripe is not yet configured.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Cancel anytime. No commitments.
        </p>
      </CardContent>
    </Card>
  );
}
