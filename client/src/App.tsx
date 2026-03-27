import { useEffect } from "react";
import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, Moon } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import Dashboard from "@/pages/dashboard";
import Messages from "@/pages/messages";
import Vault from "@/pages/vault";
import CalendarPage from "@/pages/calendar-page";
import Media from "@/pages/media";
import ThinkingOfYou from "@/pages/thinking-of-you";
import Photos from "@/pages/photos";
import Memories from "@/pages/memories";
import FamilyPage from "@/pages/family";
import Pulse from "@/pages/pulse";
import GraphPage from "@/pages/graph";
import Chat from "@/pages/chat";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/pulse" component={Pulse} />
      <Route path="/messages" component={Messages} />
      <Route path="/vault" component={Vault} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/media" component={Media} />
      <Route path="/thinking-of-you" component={ThinkingOfYou} />
      <Route path="/photos" component={Photos} />
      <Route path="/memories" component={Memories} />
      <Route path="/family" component={FamilyPage} />
      <Route path="/graph" component={GraphPage} />
      <Route path="/chat" component={Chat} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function WebSocketNotifications() {
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case "pulse":
        toast({
          title: `💛 ${lastMessage.senderName || "Someone"} is thinking of you`,
        });
        break;
      case "message":
        toast({
          title: `New message from ${lastMessage.authorName || "someone"}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        break;
      case "chat":
        toast({
          title: `New chat from ${lastMessage.senderName || "someone"}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
        break;
    }
  }, [lastMessage, toast]);

  return null;
}

function AppLayout() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <WebSocketNotifications />
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-1 p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <AppRouter />
          </main>
        </div>
      </div>
      <PWAInstallPrompt />
    </SidebarProvider>
  );
}

function AuthGate() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return <AppLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Router hook={useHashLocation}>
            <AuthGate />
          </Router>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
