import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Bot, BrainCircuit, Building2, LockKeyhole, Mail, Scale, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { loginAction } from "../lib/actions";
import { useAuth } from "../store";
import { Button, Input, Label } from "../components/ui";
import { Logo } from "../components/layout";

const DEMO = [
  { role: "Super Admin", email: "admin@omni.com", password: "admin123", desc: "Full platform + settings" },
  { role: "Collection Manager", email: "manager@omni.com", password: "manager123", desc: "Allocation, agencies, approvals" },
  { role: "Collection Agent", email: "agent@omni.com", password: "agent123", desc: "Dialer workspace + worklist" },
  { role: "Agency User", email: "agency@omni.com", password: "agency123", desc: "Placed batches portal" },
  { role: "Legal User", email: "legal@omni.com", password: "legal123", desc: "Case lifecycle tracker" },
];

const MODULES = [
  { icon: BrainCircuit, label: "AI propensity scoring & auto-allocation" },
  { icon: Zap, label: "Predictive dialer with live agent scripts" },
  { icon: Bot, label: "Ava — AI voice bot with transcript logs" },
  { icon: Building2, label: "Agency placement & commission tracking" },
  { icon: Scale, label: "Legal lifecycle & write-off approval matrix" },
];

export function LoginPage() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    const res = await loginAction({ email, password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error("Sign-in failed", { description: res.error });
      return;
    }
    toast.success(`Welcome back, ${res.data.name.split(" ")[0]}`, { description: "Session established — RBAC policy applied." });
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative">
          <div className="[&_p]:text-zinc-100 [&_.text-muted-foreground]:text-zinc-400 [&>div>div>div:first-child]:bg-zinc-100">
            <Logo />
          </div>
          <h1 className="mt-14 max-w-md font-display text-4xl font-semibold leading-[1.12] tracking-tight">
            One OS for the entire recovery lifecycle.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
            Collections, dialer, AI voice, agencies, legal and write-offs — unified across loans, cards, Shariah, auto, corporate, commercial and trade finance.
          </p>

          <div className="mt-10 space-y-3">
            {MODULES.map((m, i) => (
              <div key={m.label} className="anim-fade-up flex items-center gap-3 text-[13px] text-zinc-300" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400">
                  <m.icon className="h-3.5 w-3.5" />
                </span>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-6 border-t border-zinc-800/80 pt-6">
          <div>
            <p className="tnum font-display text-xl font-semibold text-white">$48.2M</p>
            <p className="text-[11px] text-zinc-500">Outstanding under management</p>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div>
            <p className="tnum font-display text-xl font-semibold text-emerald-400">31.4%</p>
            <p className="text-[11px] text-zinc-500">Rolling collection rate</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400 text-emerald-400" />
            All systems operational
          </div>
        </div>
      </div>

      {/* form panel */}
      <div className="flex flex-1 items-center justify-center bg-background px-5">
        <div className="w-full max-w-[400px] anim-fade-up">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <div className="mb-1.5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Secure console</p>
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Sign in to OmniRecover</h2>
          <p className="mt-1 text-sm text-muted-foreground">Role-based access · every session is audited.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <Label>Work email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@omni.com" className="pl-9" autoComplete="email" />
              </div>
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" autoComplete="current-password" />
              </div>
            </div>

            {error && (
              <div className="anim-fade-up rounded-md border border-rose-600/25 bg-rose-600/8 px-3 py-2.5 text-xs font-medium text-rose-700 dark:bg-rose-600/10 dark:text-rose-400">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="h-10 w-full">
              {loading ? "Verifying credentials…" : "Sign in"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-2.5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Demo credentials</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-1">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                    setError(null);
                  }}
                  className="group flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left transition-all duration-150 hover:border-primary/40 hover:bg-muted"
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground">{d.role}</p>
                    <p className="text-[11px] text-muted-foreground">{d.desc}</p>
                  </div>
                  <span className="tnum text-[11px] text-muted-foreground transition-colors group-hover:text-primary">{d.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Click a role to pre-fill, then sign in.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
