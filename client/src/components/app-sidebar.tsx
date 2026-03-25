import {
  LayoutDashboard,
  MessageCircle,
  Shield,
  Calendar,
  Play,
  Heart,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Messages", url: "/messages", icon: MessageCircle },
  { title: "Vault", url: "/vault", icon: Shield },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Media Room", url: "/media", icon: Play },
  { title: "Thinking of You", url: "/thinking-of-you", icon: Heart },
  { title: "Family", url: "/family", icon: Users },
];

function OhanaLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-label="MyOhana logo"
      className="shrink-0"
    >
      {/* Five dots in a constellation — family stars */}
      <circle cx="14" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="7" cy="12" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="21" cy="12" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="9" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
      <circle cx="19" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
      {/* Connecting lines */}
      <line x1="14" y1="6" x2="7" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="14" y1="6" x2="21" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="7" y1="12" x2="9" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="21" y1="12" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <line x1="9" y1="21" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
    </svg>
  );
}

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="sidebar-nav">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <OhanaLogo />
          <span className="text-lg font-bold tracking-tight text-foreground">
            MyOhana
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={isActive ? "bg-primary/10 text-primary font-medium" : ""}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground text-center">
          Subscriber #1 — The Foss Family
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
