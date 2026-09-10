import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, BrainCircuit, Building2, CheckCircle2, Headphones, Play, Scale, Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useData } from "../store";
import { runAllocationAction } from "../lib/actions";
import type { AllocationSummary, Lane, ScoreWeights } from "../lib/types";
import { BUCKET_COLORS, cn, fmtMoneyCompact, timeAgo, todayISO } from "../lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, LANE_META, Skeleton } from "../components/ui";
import { Avatar, PageContainer } from "../components/layout";

const STAGES = ["Scoring 260 accounts", "Computing propensity bands", "Balancing agent workloads", "Committing assignments"];

const WEIGHT_LABELS: { key: keyof ScoreWeights; label: string; hint: string }[] = [
  { key: "dpd", label: "Delinquency age", hint: "Fresher debt recovers faster" },
  { key: "balance", label: "Balance weight", hint: "Larger exposures prioritized" },
  { key: "behavior", label: "Payment behavior", hint: "Historical honoring of PTPs" },
  { key: "recency", label: "Contact recency", hint: "Recently reached = warmer" },
];

export function WorklistPage() {
  const { accounts, users, weights, bands, lastAllocation } = useData();
  const setWeights = useData((s) => s.setWeights);
  const setBands = useData((s) => s.setBands);
  const navigate = useNavigate();

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(-1);
  const [summary, setSummary] = useState<AllocationSummary | null>(lastAllocation);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const lanes = useMemo(() => {
    const active = accounts.filter((a) => ["NEW", "IN_COLLECTIONS", "PTP", "BROKEN_PTP"].includes(a.status));
    const by = (lane: Lane) => active.filter((a) => a.lane === lane);
    return (["TOP_AGENT", "STANDARD", "VOICE_BOT", "LEGAL"] as Lane[]).map((lane) => {
      const items = by(lane);
      return { lane, count: items.length, value: items.reduce((s, a) => s + a.outstanding, 0) };
    });
  }, [accounts]);

  const scoredAccounts = useMemo(
    () =>
      accounts
        .filter((a) => ["NEW", "IN_COLLECTIONS", "PTP", "BROKEN_PTP"].includes(a.status))
        .sort((a, b) => b.score - a.score)
        .slice(0, 14),
    [accounts]
  );

  const ownerName = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : null);
  }, [users]);

  const run = async () => {
    setRunning(true);
    setSummary(null);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => { const t = window.setTimeout(r, 520); timers.current.push(t); });
    }
    const res = await runAllocationAction();
    setRunning(false);
    setStage(-1);
    if (res.ok) {
      setSummary(res.data);
      setRanAt(todayISO());
      toast.success("Allocation complete", {
        description: `${res.data.scored} accounts routed — ${res.data.topAgent} top-agent · ${res.data.voiceBot} voice-bot · ${res.data.legal} legal in ${res.data.durationMs}ms.`,
      });
    } else {
      toast.error("Allocation failed", { description: res.error });
    }
  };

  const laneIcon = (lane: Lane) =>
    lane === "TOP_AGENT" ? <UserCheck className="h-4 w-4" /> : lane === "STANDARD" ? <Headphones className="h-4 w-4" /> : lane === "VOICE_BOT" ? <Bot className="h-4 w-4" /> : <Scale className="h-4 w-4" />;
  const laneColor = (lane: Lane) =>
    lane === "TOP_AGENT" ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400" : lane === "STANDARD" ? "bg-blue-600/10 text-blue-600 dark:text-blue-400" : lane === "VOICE_BOT" ? "bg-violet-600/10 text-violet-600 dark:text-violet-400" : "bg-rose-600/10 text-rose-600 dark:text-rose-400";

  return (
    <PageContainer>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* engine parameters */}
        <Card className="anim-fade-up">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" /> Engine Parameters</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Weighted propensity model — changes persist instantly</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {WEIGHT_LABELS.map((w) => (
                <div key={w.key}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <div>
                      <span className="text-xs font-semibold">{w.label}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{w.hint}</span>
                    </div>
                    <span className="tnum text-xs font-semibold text-primary">{weights[w.key]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={weights[w.key]}
                    disabled={running}
                    onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                    aria-label={w.label}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3.5">
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">Top-agent band</span><span className="tnum font-semibold text-success">≥ {bands.top}</span></div>
                  <input type="range" min={55} max={95} value={bands.top} disabled={running} onChange={(e) => setBands({ ...bands, top: Number(e.target.value) })} className="w-full accent-emerald-600" aria-label="Top agent band" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">Standard band</span><span className="tnum font-semibold text-primary">≥ {bands.standard}</span></div>
                  <input type="range" min={20} max={70} value={bands.standard} disabled={running} onChange={(e) => setBands({ ...bands, standard: Number(e.target.value) })} className="w-full accent-blue-600" aria-label="Standard band" />
                </div>
              </div>

              <Button className="w-full" loading={running} onClick={run}>
                {!running && <Play className="h-4 w-4" />}
                {running ? STAGES[Math.max(0, stage)] + "…" : "Run allocation engine"}
              </Button>

              {running && (
                <div className="space-y-1.5">
                  {STAGES.map((s, i) => (
                    <div key={s} className={cn("flex items-center gap-2 text-[11px] transition-opacity", i <= stage ? "opacity-100" : "opacity-35")}>
                      {i < stage ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : i === stage ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <span className="h-3.5 w-3.5 rounded-full border border-border" />}
                      <span className={i <= stage ? "font-medium" : "text-muted-foreground"}>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {summary && !running && (
                <div className="anim-fade-up rounded-md border border-emerald-600/25 bg-emerald-600/5 px-3 py-2.5 text-[11px] leading-relaxed">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Last run {ranAt ? `· ${timeAgo(ranAt)}` : ""}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {summary.scored} accounts · {fmtMoneyCompact(summary.valueAllocated)} allocated · engine time {summary.durationMs}ms
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* lane overview */}
        <div className="space-y-3 xl:col-span-2">
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            {lanes.map((l) => (
              <Card key={l.lane} className="p-4">
                <span className={cn("mb-2.5 flex h-8 w-8 items-center justify-center rounded-md", laneColor(l.lane))}>{laneIcon(l.lane)}</span>
                <p className="text-[11px] font-medium text-muted-foreground">{LANE_META[l.lane].label}</p>
                <p className="tnum mt-0.5 font-display text-xl font-semibold">{l.count}</p>
                <p className="tnum mt-0.5 text-[11px] text-muted-foreground">{fmtMoneyCompact(l.value)} exposure</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Priority Queue · by propensity score</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Top {scoredAccounts.length} actionable accounts · click to open Customer 360</p>
              </div>
              <Badge variant="outline"><Building2 className="h-3 w-3" /> {scoredAccounts.length ? fmtMoneyCompact(scoredAccounts.reduce((s, a) => s + a.outstanding, 0)) : "$0"} in view</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              {running ? (
                <div className="space-y-2 py-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-3">Account</th><th className="py-2 pr-3">Score</th><th className="py-2 pr-3">Factors</th><th className="py-2 pr-3">DPD</th><th className="py-2 pr-3 text-right">Outstanding</th><th className="py-2 pr-3">Lane</th><th className="py-2">Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoredAccounts.map((a) => {
                        const owner = ownerName(a.ownerId);
                        return (
                          <tr key={a.id} onClick={() => navigate(`/customers/${a.cif}`)} className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/60">
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={a.customer} size="sm" />
                                <div>
                                  <p className="text-xs font-semibold leading-4">{a.customer}</p>
                                  <p className="tnum text-[10px] text-muted-foreground">{a.id} · {a.product}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                  <div className={cn("h-full rounded-full", a.score >= bands.top ? "bg-success" : a.score >= bands.standard ? "bg-primary" : "bg-warning")} style={{ width: `${a.score}%` }} />
                                </div>
                                <span className="tnum text-xs font-semibold">{a.score}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">
                              <div className="flex w-24 items-center gap-0.5" title={`DPD ${Math.round(a.factors.dpd * 100)} · Balance ${Math.round(a.factors.balance * 100)} · Behavior ${Math.round(a.factors.behavior * 100)} · Recency ${Math.round(a.factors.recency * 100)}`}>
                                {[
                                  { v: a.factors.dpd, c: "bg-blue-500" },
                                  { v: a.factors.balance, c: "bg-blue-300" },
                                  { v: a.factors.behavior, c: "bg-emerald-500" },
                                  { v: a.factors.recency, c: "bg-amber-500" },
                                ].map((f, i) => (
                                  <div key={i} className="h-3 flex-1 overflow-hidden rounded-[2px] bg-muted">
                                    <div className={cn("h-full", f.c)} style={{ width: `${f.v * 100}%` }} />
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">
                              <span className="flex items-center gap-1.5 text-xs font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLORS[a.bucket] }} />{a.dpd}</span>
                            </td>
                            <td className="tnum py-2.5 pr-3 text-right text-[13px] font-semibold">{fmtMoneyCompact(a.outstanding)}</td>
                            <td className="py-2.5 pr-3">{a.lane ? <Badge variant={LANE_META[a.lane].variant}>{LANE_META[a.lane].label}</Badge> : <span className="text-[11px] text-muted-foreground">unrouted</span>}</td>
                            <td className="py-2.5 text-xs text-muted-foreground">{owner ? owner.split(" ")[0] : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground">
            Routing rule — score ≥ {bands.top}: senior agents · ≥ {bands.standard}: standard queue · below: AI Voice Bot · 120+ DPD with ≥ $40K: legal review. Workload is balanced round-robin across {users.filter((u) => u.role === "AGENT" && u.active).length} active agents.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
