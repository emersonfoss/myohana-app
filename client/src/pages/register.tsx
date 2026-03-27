import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Register() {
  const [, navigate] = useLocation();
  const [familyName, setFamilyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/register", {
        familyName,
        email,
        password,
        name,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/");
    },
    onError: (err: Error) => {
      if (err.message.includes("400")) {
        setError("Email already registered or invalid data");
      } else {
        setError("Registration failed. Please try again.");
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 page-enter">
      <div className="w-full max-w-md space-y-6">
        <Card data-testid="register-card">
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
                Create Your Family Hub
              </h1>
              <p className="text-sm text-muted-foreground mt-1">A private space for your family to connect</p>
            </div>
          </CardHeader>
          <CardContent>
            <form
              data-testid="register-form"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                registerMutation.mutate();
              }}
              className="space-y-4"
            >
              {error && (
                <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2" data-testid="register-error">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="familyName">Family Name</Label>
                <Input
                  id="familyName"
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="The Smith Family"
                  required
                  autoComplete="organization"
                  data-testid="input-family-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  autoComplete="name"
                  data-testid="input-name"
                />
              </div>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong password"
                  required
                  autoComplete="new-password"
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending ? "Creating..." : "Start Your Family Hub"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <a
                  href="#/login"
                  className="text-primary hover:underline font-medium"
                  data-testid="link-login"
                >
                  Sign in
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
