import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  Bell, BrainCircuit, Building2, ChevronsLeft, ChevronsRight, FileMinus2,
  Gauge, Headphones, Layers, LogOut, Moon, PanelLeftClose, Scale, Search, Settings2, Sun,
  CircleDollarSign, PhoneCall, Bot, ShieldAlert, UserCheck, Info,
} from "lucide-react";
import { cn, initials, timeAgo } from "../lib/utils";
import { useAuth, useData, useNow, useUI } from "../store";
import type { Role } from "../lib/types";
import { Badge, Kbd, Menu, MenuItem } from "./ui";

/* ---------------- nav config ---------------- */

export interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
  roles: Role[];
  group: string;
}

const ALL: Role[] = ["SUPER_ADMIN", "MANAGER", "AGENT", "AGENCY", "LEGAL"];

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge, roles: ALL, group: "Overview" },
  { to: "/portfolio", label: "Portfolio", icon: Layers, roles: ALL, group: "Overview" },
  { to: "/worklist", label: "Work Allocation", icon: BrainCircuit, roles: ["SUPER_ADMIN", "MANAGER"], group: "Operations" },
  { to: "/comms", label: "Communication Hub", icon: Headphones, roles: ["SUPER_ADMIN", "MANAGER", "AGENT", "AGENCY"], group: "Operations" },
  { to: "/agencies", label: "Agencies", icon: Building2, roles: ["SUPER_ADMIN", "MANAGER", "AGENCY"], group: "Recovery" },
  { to: "/legal", label: "Legal", icon: Scale, roles: ["SUPER_ADMIN", "MANAGER", "LEGAL"], group: "Recovery" },
  { to: "/writeoffs", label: "Write-offs", icon: FileMinus2, roles: ["SUPER_ADMIN", "MANAGER", "LEGAL"], group: "Recovery" },
  { to: "/settings", label: "Settings", icon: Settings2, roles: ["SUPER_ADMIN"], group: "Administration" },
];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Collection Manager",
  AGENT: "Collection Agent",
  AGENCY: "Agency User",
  LEGAL: "Legal User",
};

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 dark:bg-zinc-100">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none">
          <path d="M7 21.5 13.5 15l3.5 3.5L24 11.5" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.5 11.5H24V16" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-tight text-foreground">OmniRecover</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Recovery OS</p>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const palette = ["bg-blue-600", "bg-emerald-600", "bg-rose-600", "bg-amber-600", "bg-violet-600"];
  const idx = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return (
    <div className={cn("flex items-center justify-center rounded-full font-display font-semibold text-white", palette[idx], size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[11px]")}>
      {initials(name)}
    </div>
  );
}

/* ---------------- activity icon ---------------- */

function ActivityIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "PAYMENT": return <CircleDollarSign className={cn(cls, "text-success")} />;
    case "CALL": return <PhoneCall className={cn(cls, "text-blue-500")} />;
    case "BOT": return <Bot className={cn(cls, "text-violet-500")} />;
    case "ALERT": return <ShieldAlert className={cn(cls, "text-destructive")} />;
    case "PTP": return <UserCheck className={cn(cls, "text-emerald-500")} />;
    case "LEGAL": return <Scale className={cn(cls, "text-rose-500")} />;
    default: return <Info className={cn(cls, "text-muted-foreground")} />;
  }
}

/* ---------------- shell ---------------- */

export function Shell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const user = useAuth((s) => s.user);
  const { sidebarCollapsed, toggleSidebar, theme, setTheme } = useUI();
  const activity = useData((s) => s.activity);
  const logout = useAuth((s) => s.logout);
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  useNow(30000);

  useEffect(() => setDrawer(false), [location.pathname]);
  if (!user) return null;

  const groups = Array.from(new Set(NAV.filter((n) => n.roles.includes(user.role)).map((n) => n.group)));
  const visible = NAV.filter((n) => n.roles.includes(user.role));

  const sidebarInner = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center border-b border-border px-4", compact && "justify-center px-0")}>
        <Logo compact={compact} />
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((g) => (
          <div key={g} className="mb-4">
            {!compact && <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{g}</p>}
            <div className="space-y-0.5">
              {visible.filter((n) => n.group === g).map((n) => {
                const active = location.pathname.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    title={compact ? n.label : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] font-medium transition-all duration-150",
                      compact && "justify-center px-0",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <n.icon className={cn("h-[17px] w-[17px] shrink-0 transition-transform duration-150", !active && "group-hover:scale-105")} />
                    {!compact && n.label}
                    {!compact && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-2.5">
        <div className={cn("flex items-center gap-2.5 rounded-md px-1.5 py-1.5", compact && "justify-center px-0")}>
          <Avatar name={user.name} />
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-4">{user.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</p>
            </div>
          )}
          {!compact && (
            <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-card transition-[width] duration-200 ease-out lg:block",
          sidebarCollapsed ? "w-[64px]" : "w-[228px]"
        )}
      >
        {sidebarInner(sidebarCollapsed)}
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-zinc-950/50 anim-fade-in" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[240px] border-r border-border bg-card anim-slide-left">
            {sidebarInner(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <button onClick={() => setDrawer(true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" aria-label="Open menu">
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={toggleSidebar}
            className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block"
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[15px] font-semibold tracking-tight leading-5">{title}</h1>
            {subtitle && <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{subtitle}</p>}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search…</span>
              <span className="ml-3 flex items-center gap-0.5"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
            </button>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md p-2 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
            </button>

            <Menu
              trigger={
                <button className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Notifications">
                  <Bell className="h-[17px] w-[17px]" />
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                </button>
              }
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live activity</p>
              <div className="max-h-[320px] overflow-y-auto">
                {activity.slice(0, 8).map((a) => (
                  <div key={a.id} className="flex gap-2.5 rounded-md px-2.5 py-2 hover:bg-muted">
                    <div className="mt-0.5"><ActivityIcon type={a.type} /></div>
                    <div className="min-w-0">
                      <p className="text-xs leading-snug text-foreground">{a.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{a.actor} · {timeAgo(a.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Menu>

            <Menu
              trigger={
                <button className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-muted">
                  <Avatar name={user.name} />
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-semibold leading-4">{user.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
                  </span>
                </button>
              }
            >
              <div className="border-b border-border px-2.5 pb-2 pt-1">
                <p className="text-[13px] font-semibold">{user.name}</p>
                <p className="text-[11px] text-muted-foreground">{user.email}</p>
                <Badge variant="blue" className="mt-1.5">{ROLE_LABEL[user.role]}</Badge>
              </div>
              <div className="pt-1">
                <MenuItem danger onClick={logout}><LogOut className="h-3.5 w-3.5" /> Sign out</MenuItem>
              </div>
            </Menu>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/* ---------------- RBAC guard ---------------- */

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-5 md:px-6", className)}>{children}</div>;
}
