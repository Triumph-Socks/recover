import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, BrainCircuit, CircleDollarSign, LogOut, Moon, RotateCcw, Search, Sun, UserRound } from "lucide-react";
import { NAV } from "./layout";
import { useAuth, useData, useUI } from "../store";
import { fmtMoneyCompact } from "../lib/utils";
import { toast } from "sonner";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const { theme, setTheme } = useUI();
  const accounts = useData((s) => s.accounts);
  const resetData = useData((s) => s.resetData);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = useMemo(() => (user ? NAV.filter((n) => n.roles.includes(user.role)) : []), [user]);

  const matchedAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return accounts
      .filter(
        (a) =>
          a.customer.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.cif.toLowerCase().includes(q) ||
          a.product.toLowerCase().includes(q)
      )
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 6);
  }, [accounts, query]);

  if (!user) return null;

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  return open
    ? createPortal(
        <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]">
          <div className="fixed inset-0 bg-zinc-950/55 anim-fade-in" onClick={() => setOpen(false)} />
          <Command
            label="Global search"
            shouldFilter={false}
            className="relative w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl anim-scale-in"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search accounts, customers, pages, actions…"
                className="h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <button onClick={() => setOpen(false)} className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </button>
            </div>
            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-xs text-muted-foreground">No results for “{query}”</Command.Empty>

              {matchedAccounts.length > 0 && (
                <Command.Group heading="Accounts" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                  {matchedAccounts.map((a) => (
                    <Command.Item
                      key={a.id}
                      value={`acc-${a.id}`}
                      onSelect={() => go(`/customers/${a.cif}`)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted transition-colors"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-400">
                        <UserRound className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{a.customer}</p>
                        <p className="text-[11px] text-muted-foreground">{a.id} · {a.product} · {a.dpd} DPD</p>
                      </div>
                      <span className="tnum text-xs font-semibold">{fmtMoneyCompact(a.outstanding)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Pages" className="mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                {nav.map((n) => (
                  <Command.Item
                    key={n.to}
                    value={`page-${n.label}`}
                    onSelect={() => go(n.to)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted transition-colors"
                  >
                    <n.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{n.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group heading="Quick actions" className="mt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
                <Command.Item
                  value="action-theme"
                  onSelect={() => {
                    setTheme(theme === "dark" ? "light" : "dark");
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted transition-colors"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                  <span className="flex-1">Switch to {theme === "dark" ? "light" : "dark"} mode</span>
                </Command.Item>
                <Command.Item value="action-allocate" onSelect={() => go("/worklist")} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted transition-colors">
                  <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">Open AI Work Allocation</span>
                </Command.Item>
                {(user.role === "AGENT" || user.role === "MANAGER") && (
                  <Command.Item value="action-bot" onSelect={() => go("/comms?tab=bot")} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted transition-colors">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">View AI Voice Bot logs</span>
                  </Command.Item>
                )}
                {user.role === "SUPER_ADMIN" && (
                  <Command.Item
                    value="action-reset"
                    onSelect={() => {
                      resetData();
                      setOpen(false);
                      toast.info("Demo dataset regenerated", { description: "All accounts, payments and cases re-seeded." });
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted transition-colors"
                  >
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">Reset demo data</span>
                  </Command.Item>
                )}
                <Command.Item
                  value="action-logout"
                  onSelect={() => {
                    useAuth.getState().logout();
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-destructive aria-selected:bg-muted transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="flex-1">Sign out</span>
                </Command.Item>
              </Command.Group>

              <div className="mt-1 flex items-center gap-3 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><CircleDollarSign className="h-3 w-3" /> OmniRecover OS</span>
                <span className="ml-auto">{accounts.length.toLocaleString()} accounts indexed</span>
              </div>
            </Command.List>
          </Command>
        </div>,
        document.body
      )
    : null;
}
