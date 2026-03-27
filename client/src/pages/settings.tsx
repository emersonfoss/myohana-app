import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreditCard, Users, Mail, Copy, Check, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Family, FamilyMember } from "@shared/schema";

interface Subscription {
  id: number;
  familyId: number;
  status: string;
  plan: string;
  priceMonthly: number;
  startedAt: string;
  expiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
}

interface AppConfig {
  stripePublishableKey: string | null;
  billingEnabled: boolean;
}

export default function Settings() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: user } = useQuery<{ id: number; name: string; email: string; familyId: number; role: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: Infinity,
  });

  const { data: billingData, isLoading: billingLoading } = useQuery<{ subscription: Subscription | null }>({
    queryKey: ["/api/billing"],
  });

  const { data: familyData, isLoading: familyLoading } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: appConfig } = useQuery<AppConfig>({
    queryKey: ["/api/config"],
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/invite");
      return res.json();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/cancel");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      if (data?.message) {
        toast({ title: "Subscription", description: data.message });
      }
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await apiRequest("POST", "/api/billing/subscribe", { plan });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      }
    },
    onError: (error: Error) => {
      if (error.message.includes("Billing not configured")) {
        toast({ title: "Billing Coming Soon", description: "Stripe billing is not yet configured.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/billing/portal");
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handle billing=success / billing=cancelled query params on return from Stripe
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("billing=success")) {
      toast({ title: "Welcome to MyOhana!", description: "Your subscription is now active." });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      // Clean up the URL
      window.history.replaceState(null, "", "/#/settings");
    } else if (hash.includes("billing=cancelled")) {
      toast({ title: "Checkout cancelled", description: "You can subscribe any time from Settings." });
      window.history.replaceState(null, "", "/#/settings");
    }
  }, [toast]);

  const copyInviteCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (billingLoading || familyLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const sub = billingData?.subscription;
  const family = familyData?.family;
  const members = familyData?.members || [];
  const billingEnabled = appConfig?.billingEnabled ?? false;

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const planLabel = sub?.plan === "extended" ? "Extended" : "Family";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          data-testid="settings-title"
        >
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your family hub</p>
      </div>

      {/* Subscription Section */}
      <Card data-testid="subscription-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sub && sub.status === "active" ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-sm" data-testid="plan-badge">
                    {planLabel} — {formatPrice(sub.priceMonthly)}/mo
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                    <span className="text-sm text-muted-foreground">Active</span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Member since: {format(new Date(sub.startedAt), "MMMM d, yyyy")}</p>
                {sub.expiresAt && (
                  <p>Next billing: {format(new Date(sub.expiresAt), "MMMM d, yyyy")}</p>
                )}
              </div>
              {family && (
                <Badge variant="outline" className="text-xs">
                  {family.name} — Subscriber #{sub.id}
                </Badge>
              )}
              <div className="pt-2 flex flex-wrap gap-2">
                {billingEnabled && sub.stripeCustomerId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid="button-manage-billing"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {portalMutation.isPending ? "Loading..." : "Manage Billing"}
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      data-testid="button-cancel-subscription"
                    >
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your family hub will remain accessible until the end of your current billing period.
                        You can resubscribe at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-cancel"
                      >
                        Yes, Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {sub?.status === "cancelled"
                  ? "Your subscription has been cancelled."
                  : sub?.status === "past_due"
                    ? "Your payment is past due. Please update your payment method."
                    : "No active subscription."}
              </p>
              {!billingEnabled ? (
                <p className="text-sm text-muted-foreground italic">
                  Billing coming soon — Stripe is not yet configured.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => subscribeMutation.mutate("family")}
                    disabled={subscribeMutation.isPending}
                    data-testid="button-subscribe"
                  >
                    {subscribeMutation.isPending ? "Redirecting..." : "Subscribe — $19.99/mo"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => subscribeMutation.mutate("extended")}
                    disabled={subscribeMutation.isPending}
                    data-testid="button-subscribe-extended"
                  >
                    {subscribeMutation.isPending ? "Redirecting..." : "Extended — $29.99/mo"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Settings Section */}
      <Card data-testid="family-settings-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Family Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Family Name</label>
            <Input
              value={family?.name || ""}
              readOnly
              className="mt-1"
              data-testid="input-family-name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Invite Code</label>
            <p className="text-xs text-muted-foreground mb-2">
              Share this code with family members so they can join your hub.
            </p>
            {inviteMutation.data ? (
              <div className="flex items-center gap-2">
                <Input
                  value={inviteMutation.data.inviteCode}
                  readOnly
                  className="font-mono"
                  data-testid="invite-code-display"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyInviteCode(inviteMutation.data.inviteCode)}
                  data-testid="button-copy-invite"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
                data-testid="button-generate-invite"
              >
                {inviteMutation.isPending ? "Generating..." : "Generate Invite Code"}
              </Button>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Family Members</label>
            <div className="mt-2 space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                  data-testid={`member-${m.id}`}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Section */}
      <Card data-testid="account-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input
              value={user?.email || ""}
              readOnly
              className="mt-1"
              data-testid="input-email"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled data-testid="button-change-password">
              Change Password
            </Button>
            <Button variant="outline" size="sm" disabled data-testid="button-export-data">
              Export Data
            </Button>
          </div>

          <div className="pt-2 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  data-testid="button-delete-account"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All your family data, messages, photos, and documents will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete (Coming Soon)
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
