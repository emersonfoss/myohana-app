import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/");
    },
    onError: (err: Error) => {
      setError(err.message.includes("401") ? "Invalid email or password" : "Login failed");
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 page-enter">
      <div className="w-full max-w-md space-y-6">
        <Card data-testid="login-card">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <svg width="48" height="48" viewBox="0 0 28 28" fill="none" className="text-primary">
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
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                Welcome Back
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your family hub</p>
            </div>
          </CardHeader>
          <CardContent>
            <form
              data-testid="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                loginMutation.mutate();
              }}
              className="space-y-4"
            >
              {error && (
                <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2" data-testid="login-error">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#/forgot-password"
                    className="text-xs text-primary hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Forgot Password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have a family hub?{" "}
                <a
                  href="#/register"
                  className="text-primary hover:underline font-medium"
                  data-testid="link-register"
                >
                  Create one
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Warm footer message */}
        <p className="text-xs text-center text-muted-foreground/60">
          MyOhana — Where family comes first
        </p>
      </div>
    </div>
  );
}
