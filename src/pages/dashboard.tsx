import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Clock3, PhoneCall, TrendingUp, UserCheck, Bot, Scale, ShieldAlert, Info } from "lucide-react";
import { toast } from "sonner";
import { useData } from "../store";
import { BUCKETS, type Activity } from "../lib/types";
import { BUCKET_COLORS, cn, fmtMoney, fmtMoneyCompact, fmtPct, timeAgo } from "../lib/utils";
import { resolvePTPAction } from "../lib/actions";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, Tabs } from "../components/ui";
import { BucketsBar, CollectionsArea, Sparkline } from "../components/charts";
import { Avatar, PageContainer } from "../components/layout";

const DAILY_TARGET_FACTOR = 1.18;

export function DashboardPage() {
  const { accounts, payments, activity, users } = useData();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"30" | "60" | "90">("30");
  const [busyPtp, setBusyPtp] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 750);
    return () => clearTimeout(t);
  }, []);

  const stats = useMemo(() => {
    const active = accounts.filter((a) => a.status !== "WRITTEN_OFF" && a.outstanding > 0);
    const totalOutstanding = active.reduce((s, a) => s + a.outstanding, 0);
    const delinquent = active.filter((a) => a.dpd > 0);
    const delinquentBal = delinquent.reduce((s, a) => s + a.outstanding, 0);

    const days = Number(range);
    const cutoff = Date.now() - days * 86400000;
    const byDay = new Map<string, number>();
    let collected30 = 0;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let mtd = 0;
    for (const p of payments) {
      const t = new Date(p.date).getTime();
      if (t < cutoff) continue;
      const key = p.date.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + p.amount);
      if (t >= Date.now() - 30 * 86400000) collected30 += p.amount;
      if (t >= monthStart.getTime()) mtd += p.amount;
    }

    const series: { label: string; collected: number; target: number }[] = [];
    const vals: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const v = byDay.get(key) ?? 0;
      vals.push(v);
      series.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), collected: v, target: 0 });
    }
    const avg = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    const target = Math.round((avg * DAILY_TARGET_FACTOR) / 1000) * 1000;
    series.forEach((s) => (s.target = target));

    const collectionRate = (mtd / (mtd + delinquentBal)) * 100;

    const ptps = accounts.filter((a) => a.ptp && a.ptp.kept !== null);
    const kept = ptps.filter((a) => a.ptp?.kept === true).length;
    const ptpRate = ptps.length ? (kept / ptps.length) * 100 : 0;

    const buckets = BUCKETS.filter((b) => b.code !== "CUR").map((b) => ({
      label: b.code,
      balance: accounts.filter((a) => a.bucket === b.code && a.status !== "WRITTEN_OFF").reduce((s, a) => s + a.outstanding, 0),
      color: BUCKET_COLORS[b.code],
    }));

    const agentTotals = new Map<string, number>();
    for (const p of payments) {
      if (!p.agentName) continue;
      if (new Date(p.date).getTime() < Date.now() - 30 * 86400000) continue;
      agentTotals.set(p.agentName, (agentTotals.get(p.agentName) ?? 0) + p.amount);
    }
    const topAgents = [...agentTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const channelTotals = new Map<string, { sum: number; count: number }>();
    for (const p of payments) {
      const c = channelTotals.get(p.channel) ?? { sum: 0, count: 0 };
      c.sum += p.amount;
      c.count++;
      channelTotals.set(p.channel, c);
    }
    const channels = [...channelTotals.entries()].sort((a, b) => b[1].sum - a[1].sum);
    const channelMax = channels[0]?.[1].sum ?? 1;

    const dueNow = Date.now() + 86400000;
    const ptpDue = accounts
      .filter((a) => a.ptp && a.ptp.kept === null && new Date(a.ptp.date).getTime() <= dueNow)
      .sort((a, b) => (a.ptp!.date < b.ptp!.date ? -1 : 1))
      .slice(0, 6);

    const spark = vals.slice(-14);
    return { totalOutstanding, delinquentBal, delinquentCount: delinquent.length, collected30, collectionRate, ptpRate, kept, ptpTotal: ptps.length, series, buckets, topAgents, channels, channelMax, ptpDue, spark, activeCount: active.length };
  }, [accounts, payments, range]);

  const resolvePtp = async (accountId: string, kept: boolean) => {
    setBusyPtp(accountId);
    const res = await resolvePTPAction({ accountId, kept });
    setBusyPtp(null);
    if (res.ok) toast.success(kept ? "PTP marked as kept" : "PTP marked as broken", { description: "Account stage updated." });
    else toast.error("Update failed", { description: res.error });
  };

  if (loading) return <DashboardSkeleton />;

  const rollRates = [
    { from: "B1 → B2", rate: 21.4, delta: +2.1 },
    { from: "B2 → B3", rate: 17.8, delta: -1.2 },
    { from: "B3 → B4", rate: 15.2, delta: +0.8 },
    { from: "B4 → B5", rate: 12.6, delta: -0.4 },
    { from: "Cure · B1 → Current", rate: 34.2, delta: +3.6 },
  ];

  return (
    <PageContainer>
      {/* KPI row */}
      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Outstanding</p>
              <p className="tnum mt-1.5 font-display text-[26px] font-semibold leading-7 tracking-tight">{fmtMoneyCompact(stats.totalOutstanding)}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-400"><CircleDollarSign className="h-4 w-4" /></span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <DeltaBadge value={-1.8} invert />
            <div className="w-24"><Sparkline data={stats.spark} color="#2563eb" /></div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{stats.activeCount.toLocaleString()} active accounts</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Collected · 30d</p>
              <p className="tnum mt-1.5 font-display text-[26px] font-semibold leading-7 tracking-tight text-success">{fmtMoneyCompact(stats.collected30)}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600/10 text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-4 w-4" /></span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <DeltaBadge value={4.6} />
            <div className="w-24"><Sparkline data={stats.spark.map((v, i) => v + i * 900)} color="#059669" /></div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Collection rate {fmtPct(stats.collectionRate)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">PTP Kept Rate</p>
              <p className="tnum mt-1.5 font-display text-[26px] font-semibold leading-7 tracking-tight">{fmtPct(stats.ptpRate)}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-600/10 text-amber-600 dark:text-amber-400"><UserCheck className="h-4 w-4" /></span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <DeltaBadge value={2.2} />
            <div className="w-24"><Sparkline data={[42, 45, 44, 48, 51, 50, 54, 57, 56, 61, 63, 62, 66, 68].map((v) => v * stats.ptpRate / 68)} color="#d97706" /></div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{stats.kept} of {stats.ptpTotal} promises honored</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Delinquent Balance</p>
              <p className="tnum mt-1.5 font-display text-[26px] font-semibold leading-7 tracking-tight text-destructive">{fmtMoneyCompact(stats.delinquentBal)}</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-600/10 text-rose-600 dark:text-rose-400"><ShieldAlert className="h-4 w-4" /></span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <DeltaBadge value={-2.4} invert />
            <div className="w-24"><Sparkline data={stats.spark.map((v) => Math.max(0, stats.delinquentBal / 30 - v / 3)).slice(-14)} color="#e11d48" /></div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{stats.delinquentCount.toLocaleString()} delinquent accounts</p>
        </Card>
      </div>

      {/* charts row */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Daily Collections</CardTitle>
              <CardDescription>Actuals vs. daily target (dashed)</CardDescription>
            </div>
            <Tabs value={range} onChange={(v) => setRange(v as "30" | "60" | "90")} items={[{ value: "30", label: "30D" }, { value: "60", label: "60D" }, { value: "90", label: "90D" }]} />
          </CardHeader>
          <CardContent className="pt-1">
            <CollectionsArea data={stats.series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">Live Activity <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500 text-emerald-500" /></CardTitle>
              <CardDescription>Payments, calls & system events</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="max-h-[300px] overflow-y-auto pb-2">
            <div className="space-y-0.5">
              {activity.slice(0, 10).map((a) => (
                <FeedRow key={a.id} a={a} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* lower row */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Aging Buckets</CardTitle>
              <CardDescription>Outstanding by delinquency band</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <BucketsBar data={stats.buckets} height={230} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Roll Rates</CardTitle>
              <CardDescription>Month-over-month bucket migration</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="space-y-3.5">
              {rollRates.map((r) => (
                <div key={r.from}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{r.from}</span>
                    <span className="flex items-center gap-2">
                      <span className={cn("flex items-center gap-0.5 text-[11px] font-medium", r.delta > 0 && !r.from.startsWith("Cure") ? "text-destructive" : "text-success")}>
                        {r.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(r.delta).toFixed(1)}pp
                      </span>
                      <span className="tnum w-12 text-right font-semibold">{fmtPct(r.rate)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("anim-bar h-full rounded-full", r.from.startsWith("Cure") ? "bg-success" : r.rate > 18 ? "bg-destructive" : "bg-primary")} style={{ width: `${(r.rate / 40) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Promises Due · 24h</CardTitle>
              <CardDescription>{stats.ptpDue.length} PTPs awaiting resolution</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            {stats.ptpDue.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No promises due right now.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.ptpDue.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 rounded-md border border-border bg-panel px-2.5 py-2">
                    <Avatar name={a.customer} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{a.customer}</p>
                      <p className="text-[10px] text-muted-foreground">{a.id} · due {new Date(a.ptp!.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <span className="tnum text-xs font-semibold text-success">{fmtMoney(a.ptp!.amount)}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="success" className="h-6 px-2 text-[10px]" loading={busyPtp === a.id} onClick={() => resolvePtp(a.id, true)}>Kept</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={busyPtp === a.id} onClick={() => resolvePtp(a.id, false)}>Broken</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* leaderboard + channels */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Top Collectors · 30d</CardTitle>
              <CardDescription>Ranked by cash collected</CardDescription>
            </div>
            <Link to="/portfolio" className="text-xs font-medium text-primary hover:underline">View portfolio →</Link>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="space-y-3">
              {stats.topAgents.map(([name, total], i) => {
                const isUser = users.some((u) => u.name === name);
                const max = stats.topAgents[0][1];
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="tnum w-4 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <Avatar name={name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between">
                        <p className="truncate text-xs font-semibold">{name} {isUser && <span className="text-[10px] font-normal text-muted-foreground">· internal</span>}</p>
                        <p className="tnum text-xs font-semibold text-success">{fmtMoney(total)}</p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="anim-bar h-full rounded-full bg-success" style={{ width: `${(total / max) * 100}%`, animationDelay: `${i * 0.06}s` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Collection Channels</CardTitle>
              <CardDescription>Where cash comes from</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="space-y-3">
              {stats.channels.map(([ch, v]) => (
                <div key={ch}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      {ch === "DIALER" ? <PhoneCall className="h-3.5 w-3.5 text-blue-500" /> : ch === "VOICE_BOT" ? <Bot className="h-3.5 w-3.5 text-violet-500" /> : ch === "AGENCY" ? <Scale className="h-3.5 w-3.5 text-amber-500" /> : <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />}
                      {ch === "VOICE_BOT" ? "AI Voice Bot" : ch.charAt(0) + ch.slice(1).toLowerCase()}
                    </span>
                    <span className="tnum text-muted-foreground">{fmtMoneyCompact(v.sum)} · {v.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("anim-bar h-full rounded-full", ch === "DIALER" ? "bg-primary" : ch === "VOICE_BOT" ? "bg-violet-500" : ch === "AGENCY" ? "bg-amber-500" : "bg-zinc-400")} style={{ width: `${(v.sum / stats.channelMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2.5">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[11px] leading-snug text-muted-foreground">Dialer hours 08:00–21:00 · Voice bot runs 24/7 across all time zones.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value < 0 : value > 0;
  return (
    <Badge variant={good ? "emerald" : "rose"}>
      {value > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </Badge>
  );
}

function FeedRow({ a }: { a: Activity }) {
  const icon =
    a.type === "PAYMENT" ? <CircleDollarSign className="h-3.5 w-3.5 text-success" /> :
    a.type === "CALL" ? <PhoneCall className="h-3.5 w-3.5 text-blue-500" /> :
    a.type === "BOT" ? <Bot className="h-3.5 w-3.5 text-violet-500" /> :
    a.type === "ALERT" ? <ShieldAlert className="h-3.5 w-3.5 text-destructive" /> :
    a.type === "LEGAL" ? <Scale className="h-3.5 w-3.5 text-rose-500" /> :
    a.type === "PTP" ? <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> :
    <Info className="h-3.5 w-3.5 text-muted-foreground" />;
  return (
    <div className="flex gap-2.5 rounded-md px-1.5 py-2 transition-colors hover:bg-muted/70">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-panel">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs leading-snug text-foreground">{a.message}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{a.actor} · {timeAgo(a.at)}</p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <PageContainer>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-4 h-9 w-full" />
          </Card>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2"><Skeleton className="h-4 w-40" /><Skeleton className="mt-4 h-[260px] w-full" /></Card>
        <Card className="p-4"><Skeleton className="h-4 w-32" /><div className="mt-4 space-y-3">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></Card>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-4"><Skeleton className="h-4 w-36" /><Skeleton className="mt-4 h-[220px] w-full" /></Card>
        ))}
      </div>
    </PageContainer>
  );
}
