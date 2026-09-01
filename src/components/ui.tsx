import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

/* ================= Button ================= */

type BtnVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "success";
type BtnSize = "sm" | "md" | "icon";

const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "bg-muted text-foreground hover:bg-accent border border-border",
  outline: "border border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  success: "bg-success text-white dark:text-success-foreground hover:bg-success/90 shadow-sm",
};
const btnSizes: Record<BtnSize, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  icon: "h-8 w-8",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
        btnVariants[variant],
        btnSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

/* ================= Card ================= */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-border bg-card", className)}>{children}</div>;
}
export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 pb-2", className)}>{children}</div>;
}
export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn("font-display text-[15px] font-semibold tracking-tight", className)}>{children}</h3>;
}
export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-xs text-muted-foreground mt-0.5", className)}>{children}</p>;
}
export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 pb-4", className)}>{children}</div>;
}

/* ================= Badge ================= */

type BadgeVariant = "neutral" | "blue" | "emerald" | "rose" | "amber" | "violet" | "outline";
const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  blue: "bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-600/20",
  emerald: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20",
  rose: "bg-rose-600/10 text-rose-700 dark:text-rose-400 border border-rose-600/20",
  amber: "bg-amber-600/10 text-amber-700 dark:text-amber-400 border border-amber-600/20",
  violet: "bg-violet-600/10 text-violet-700 dark:text-violet-400 border border-violet-600/20",
  outline: "border border-border text-muted-foreground",
};

export function Badge({ variant = "neutral", className, children }: { variant?: BadgeVariant; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", badgeVariants[variant], className)}>
      {children}
    </span>
  );
}

/* ================= Status mapping ================= */

export const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  NEW: { label: "New", variant: "neutral" },
  IN_COLLECTIONS: { label: "In Collections", variant: "blue" },
  PTP: { label: "PTP", variant: "emerald" },
  BROKEN_PTP: { label: "Broken PTP", variant: "amber" },
  AGENCY: { label: "Agency", variant: "violet" },
  LEGAL: { label: "Legal", variant: "rose" },
  WRITTEN_OFF: { label: "Written Off", variant: "neutral" },
  PAID: { label: "Paid", variant: "emerald" },
};

export const LANE_META: Record<string, { label: string; variant: BadgeVariant }> = {
  TOP_AGENT: { label: "Top Agent", variant: "emerald" },
  STANDARD: { label: "Standard", variant: "blue" },
  VOICE_BOT: { label: "Voice Bot", variant: "violet" },
  LEGAL: { label: "Legal Review", variant: "rose" },
};

/* ================= Form controls ================= */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70",
        "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-shadow",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 min-h-[72px]",
        "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-shadow",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-sm text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-shadow cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <label className={cn("block text-xs font-medium text-muted-foreground mb-1.5", className)}>{children}</label>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring shrink-0",
        checked ? "bg-primary" : "bg-muted border border-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200",
          checked ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}

/* ================= Dialog ================= */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <div className="fixed inset-0 bg-zinc-950/55 anim-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn("relative w-full rounded-lg border border-border bg-card shadow-2xl anim-scale-in", wide ? "max-w-2xl" : "max-w-md")}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ================= Skeleton ================= */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/* ================= Tabs ================= */

export function Tabs({ value, onChange, items, className }: { value: string; onChange: (v: string) => void; items: { value: string; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5", className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "rounded-[5px] px-3 h-7 text-xs font-medium transition-all duration-150",
            value === it.value ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ================= Table ================= */

export function Tbl({ className, children }: { className?: string; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className={cn("w-full text-sm border-collapse", className)}>{children}</table></div>;
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border bg-panel">{children}</thead>;
}
export function TRow({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn("border-b border-border last:border-0 transition-colors", onClick && "cursor-pointer hover:bg-muted/60", className)}
    >
      {children}
    </tr>
  );
}
export function TCell({ className, children, colSpan }: { className?: string; children: ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}
export function THeadCell({ className, children }: { className?: string; children: ReactNode }) {
  return <th className={cn("px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap", className)}>{children}</th>;
}

/* ================= Progress ================= */

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "success" | "destructive" | "warning" }) {
  const tones = { primary: "bg-primary", success: "bg-success", destructive: "bg-destructive", warning: "bg-warning" };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ================= Dropdown menu ================= */

export function Menu({ trigger, children, align = "right" }: { trigger: ReactNode; children: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn("absolute z-50 mt-1.5 min-w-[190px] rounded-md border border-border bg-card p-1 shadow-xl anim-scale-in", align === "right" ? "right-0" : "left-0")}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onClick, children, danger = false }: { onClick?: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

/* ================= Empty state ================= */

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center anim-fade-up">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">{icon}</div>
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ================= Kbd ================= */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
