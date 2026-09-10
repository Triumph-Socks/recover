import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bot, Building2, CircleDollarSign, MessageSquare, Mic, Phone, PhoneCall, PhoneOff, Play, Sparkles, Timer, UserRound, Voicemail } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useData } from "../store";
import { logCallAction, recordPaymentAction, runBotCampaignAction, setPTPAction } from "../lib/actions";
import type { BotCall, CallOutcome } from "../lib/types";
import { cn, fmtDuration, fmtMoney, fmtPct, timeAgo } from "../lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Input, Label, Select, Tabs, Textarea } from "../components/ui";
import { Avatar, PageContainer } from "../components/layout";

const ACTIVE = ["NEW", "IN_COLLECTIONS", "PTP", "BROKEN_PTP"];

const OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: "CONNECTED_PTP", label: "Connected — PTP secured" },
  { value: "CONNECTED_NO_PTP", label: "Connected — no promise" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "VOICEMAIL", label: "Voicemail left" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
];

export function CommsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "bot" ? "bot" : "dialer";
  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === "bot" ? { tab: "bot" } : {})}
          items={[
            { value: "dialer", label: <span className="flex items-center gap-1.5"><PhoneCall className="h-3.5 w-3.5" /> Agent Dialer</span> },
            { value: "bot", label: <span className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> AI Voice Bot</span> },
          ]}
        />
        <p className="text-[11px] text-muted-foreground">Telephony bridge: <span className="font-medium text-success">connected</span> · latency 34ms · recordings on</p>
      </div>
      {tab === "dialer" ? <DialerTab /> : <BotTab />}
    </PageContainer>
  );
}

/* ================= dialer ================= */

type CallState = { status: "idle" } | { status: "dialing" } | { status: "active"; startedAt: number };

function DialerTab() {
  const user = useAuth((s) => s.user)!;
  const { accounts, users } = useData();
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [call, setCall] = useState<CallState>({ status: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [wrapUp, setWrapUp] = useState<{ duration: number } | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome>("CONNECTED_NO_PTP");
  const [notes, setNotes] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  const agents = users.filter((u) => u.role === "AGENT");

  const queue = useMemo(() => {
    if (user.role === "AGENT") return accounts.filter((a) => a.ownerId === user.id && ACTIVE.includes(a.status));
    if (user.role === "AGENCY") return accounts.filter((a) => a.agencyId === "ag-1" && a.status === "AGENCY");
    const base = accounts.filter((a) => (a.lane === "TOP_AGENT" || a.lane === "STANDARD") && ACTIVE.includes(a.status));
    return agentFilter === "ALL" ? base : base.filter((a) => a.ownerId === agentFilter);
  }, [accounts, user, agentFilter]);

  const selected = queue.find((a) => a.id === selectedId) ?? queue[0] ?? null;

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  const startCall = () => {
    if (!selected) return;
    setCall({ status: "dialing" });
    setElapsed(0);
    window.setTimeout(() => {
      setCall({ status: "active", startedAt: Date.now() });
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    }, 1100);
  };

  const endCall = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setCall({ status: "idle" });
    setWrapUp({ duration: Math.max(1, elapsed) });
    setOutcome("CONNECTED_NO_PTP");
    setNotes("");
  };

  const quickLog = async (o: CallOutcome) => {
    if (!selected) return;
    setBusy(true);
    const res = await logCallAction({ accountId: selected.id, durationSec: Math.max(1, elapsed || 14), outcome: o, notes: "Auto-logged by dialer" });
    setBusy(false);
    if (res.ok) toast.info(`Logged: ${o.replace(/_/g, " ").toLowerCase()}`, { description: selected.customer });
    else toast.error("Logging failed", { description: res.error });
  };

  const submitWrapUp = async () => {
    if (!selected || !wrapUp) return;
    setBusy(true);
    const res = await logCallAction({ accountId: selected.id, durationSec: wrapUp.duration, outcome, notes });
    if (!res.ok) {
      setBusy(false);
      toast.error("Wrap-up failed", { description: res.error });
      return;
    }
    if (outcome === "CONNECTED_PTP") {
      await setPTPAction({
        accountId: selected.id,
        date: new Date(Date.now() + 5 * 86400000).toISOString(),
        amount: Math.round(selected.outstanding * 0.15),
      });
    }
    setBusy(false);
    setWrapUp(null);
    toast.success("Call dispositioned", { description: outcome === "CONNECTED_PTP" ? "PTP auto-created for +5 days at 15% of balance." : `${selected.customer} · ${fmtDuration(wrapUp.duration)}` });
    const idx = queue.findIndex((a) => a.id === selected.id);
    if (queue[idx + 1]) setSelectedId(queue[idx + 1].id);
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr_320px]">
      {/* queue */}
      <Card className="flex max-h-[calc(100vh-190px)] flex-col">
        <CardHeader className="pb-1">
          <div className="w-full">
            <CardTitle className="text-[13px]">Call Queue</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{queue.length} accounts · priority order</p>
            {(user.role === "MANAGER" || user.role === "SUPER_ADMIN") && (
              <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="mt-2 h-7 text-[11px]">
                <option value="ALL">All agents</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          {queue.length === 0 ? (
            <EmptyState icon={<UserRound className="h-5 w-5" />} title="Queue empty" description="Run the allocation engine to populate agent worklists." />
          ) : (
            <div className="space-y-1">
              {queue.slice(0, 40).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-all duration-150",
                    selected?.id === a.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted"
                  )}
                >
                  <Avatar name={a.customer} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold leading-4">{a.customer}</p>
                    <p className="tnum text-[10px] text-muted-foreground">{a.id} · {a.dpd} DPD</p>
                  </div>
                  <span className="tnum text-[11px] font-semibold">{fmtMoney(a.outstanding)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* call panel */}
      <Card className="flex flex-col">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /> Agent Workspace</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{user.role === "AGENCY" ? "Apex Recoveries LLC — placed accounts" : "Softphone · omni-dialer v4.2"}</p>
          </div>
          {call.status === "active" && (
            <Badge variant="emerald"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500 text-emerald-500" /> LIVE {fmtDuration(elapsed)}</Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {!selected ? (
            <EmptyState icon={<Phone className="h-5 w-5" />} title="No account selected" description="Pick an account from the queue to begin a call." />
          ) : (
            <>
              <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-6 text-center">
                <div className={cn("relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300", call.status === "active" ? "bg-emerald-600/15" : "bg-muted")}>
                  {call.status === "active" && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/10" />}
                  <span className="font-display text-2xl font-semibold">{selected.customer.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                </div>
                <p className="mt-4 font-display text-lg font-semibold tracking-tight">{selected.customer}</p>
                <p className="tnum mt-0.5 text-xs text-muted-foreground">{selected.phone} · {selected.city}</p>

                {call.status === "dialing" && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-medium text-primary"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Dialing {selected.phone}…</p>
                )}
                {call.status === "active" && (
                  <p className="tnum mt-3 font-display text-3xl font-semibold tracking-tight">{fmtDuration(elapsed)}</p>
                )}

                <div className="mt-6 flex items-center gap-2.5">
                  {call.status === "idle" && (
                    <>
                      <Button onClick={startCall} className="h-11 gap-2 rounded-full px-6 bg-success hover:bg-success/90">
                        <Phone className="h-4 w-4" /> Start call
                      </Button>
                      <Button variant="outline" className="h-11 rounded-full px-4" disabled={busy} onClick={() => quickLog("NO_ANSWER")}>
                        <Voicemail className="h-4 w-4" /> Skip / no answer
                      </Button>
                    </>
                  )}
                  {call.status === "dialing" && (
                    <Button variant="destructive" className="h-11 rounded-full px-6" onClick={() => setCall({ status: "idle" })}>
                      <PhoneOff className="h-4 w-4" /> Cancel
                    </Button>
                  )}
                  {call.status === "active" && (
                    <>
                      <Button variant="destructive" className="h-11 rounded-full px-6" onClick={endCall}>
                        <PhoneOff className="h-4 w-4" /> End & wrap up
                      </Button>
                      <Button variant="outline" className="h-11 rounded-full px-4" onClick={() => setPayOpen(true)}>
                        <CircleDollarSign className="h-4 w-4 text-success" /> Take payment
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* talk-track */}
              <div className="rounded-md border border-border bg-panel p-3.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-3 w-3 text-amber-500" /> AI talk-track suggestion</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  “Good day {selected.customer.split(" ")[0]}, this is {user.name.split(" ")[0]} from OmniRecover. Your {selected.product} balance of <span className="font-semibold text-foreground">{fmtMoney(selected.outstanding)}</span> is {selected.dpd} days past due.
                  {selected.score >= 72
                    ? " Based on your excellent history, I can offer a 3-installment plan with fee waiver if settled this week.”"
                    : " I can structure a hardship plan starting at " + fmtMoney(Math.round(selected.outstanding * 0.1)) + " per month.”"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* customer detail (right) */}
      <div className="hidden xl:block">
        {selected && <CustomerPanel accountId={selected.id} onPay={() => setPayOpen(true)} />}
      </div>

      {/* wrap-up dialog */}
      <Dialog open={wrapUp !== null} onClose={() => setWrapUp(null)} title="Call wrap-up" description={selected ? `${selected.customer} · ${fmtDuration(wrapUp?.duration ?? 0)} on line` : undefined}>
        <div className="space-y-3.5">
          <div>
            <Label>Disposition</Label>
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)}>
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed? Next step?" />
          </div>
          {outcome === "CONNECTED_PTP" && (
            <div className="anim-fade-up rounded-md border border-emerald-600/25 bg-emerald-600/5 px-3 py-2.5 text-[11px] text-emerald-700 dark:text-emerald-400">
              A PTP will be auto-created: {selected ? fmtMoney(Math.round(selected.outstanding * 0.15)) : ""} due in 5 days.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWrapUp(null)}>Discard</Button>
            <Button loading={busy} onClick={submitWrapUp}>Save disposition</Button>
          </div>
        </div>
      </Dialog>

      {/* payment dialog */}
      {selected && <PaymentDialog open={payOpen} onClose={() => setPayOpen(false)} accountId={selected.id} outstanding={selected.outstanding} customer={selected.customer} />}
    </div>
  );
}

function CustomerPanel({ accountId, onPay }: { accountId: string; onPay: () => void }) {
  const accounts = useData((s) => s.accounts);
  const a = accounts.find((x) => x.id === accountId);
  if (!a) return null;
  const rows: [string, string][] = [
    ["Account", a.id],
    ["Product", a.product],
    ["Outstanding", fmtMoney(a.outstanding)],
    ["DPD / Bucket", `${a.dpd} · ${a.bucket}`],
    ["PTP score", String(a.score)],
    ["Attempts", String(a.attempts)],
    ["Last contact", a.lastContact ? timeAgo(a.lastContact) : "never"],
    ["PTP", a.ptp ? `${fmtMoney(a.ptp.amount)} · ${new Date(a.ptp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${a.ptp.kept === null ? " (pending)" : a.ptp.kept ? " (kept)" : " (broken)"}` : "none"],
  ];
  return (
    <Card className="anim-slide-left">
      <CardHeader>
        <CardTitle className="text-[13px]">Account Brief</CardTitle>
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-xs last:border-0">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tnum text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <Button variant="success" size="sm" className="mt-3 w-full" onClick={onPay}><CircleDollarSign className="h-3.5 w-3.5" /> Record payment</Button>
      </CardContent>
    </Card>
  );
}

function PaymentDialog({ open, onClose, accountId, outstanding, customer }: { open: boolean; onClose: () => void; accountId: string; outstanding: number; customer: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Card on File");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const res = await recordPaymentAction({ accountId, amount: Number(amount), method });
    setBusy(false);
    if (res.ok) {
      toast.success("Payment captured", { description: `${fmtMoney(res.data.amount)} from ${customer} via ${method}` });
      setAmount("");
      onClose();
    } else toast.error("Payment failed", { description: res.error });
  };
  return (
    <Dialog open={open} onClose={onClose} title="Take payment over the phone" description={`${customer} · up to ${fmtMoney(outstanding)}`}>
      <div className="space-y-3.5">
        <div>
          <Label>Amount (USD)</Label>
          <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {["Card on File", "ACH Transfer", "Wire", "Direct Debit"].map((m) => <option key={m}>{m}</option>)}
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="success" loading={busy} onClick={submit}><CircleDollarSign className="h-4 w-4" /> Charge</Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ================= AI voice bot ================= */

const BOT_OUTCOME_META: Record<BotCall["outcome"], { label: string; variant: "emerald" | "blue" | "rose" | "neutral" }> = {
  PTP_CAPTURED: { label: "PTP captured", variant: "emerald" },
  CALLBACK_REQUESTED: { label: "Callback requested", variant: "blue" },
  REFUSED: { label: "Refused", variant: "rose" },
  NO_ANSWER: { label: "No answer", variant: "neutral" },
};

function BotTab() {
  const { botCalls, accounts } = useData();
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [openCall, setOpenCall] = useState<BotCall | null>(null);

  const botLane = accounts.filter((a) => a.lane === "VOICE_BOT" && ACTIVE.includes(a.status));
  const stats = useMemo(() => {
    const total = botCalls.length;
    const ptps = botCalls.filter((c) => c.outcome === "PTP_CAPTURED").length;
    const avg = total ? Math.round(botCalls.reduce((s, c) => s + c.durationSec, 0) / total) : 0;
    return { total, ptps, avg, rate: total ? (ptps / total) * 100 : 0 };
  }, [botCalls]);

  const launch = async () => {
    setCampaignBusy(true);
    const res = await runBotCampaignAction(botLane.map((a) => a.id));
    setCampaignBusy(false);
    if (res.ok) toast.success("Campaign completed", { description: `${res.data.calls} calls placed · ${res.data.ptps} promises captured by Ava.` });
    else toast.error("Campaign failed", { description: res.error });
  };

  return (
    <div className="space-y-3">
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium text-muted-foreground">Calls on record</p>
          <p className="tnum mt-0.5 font-display text-xl font-semibold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-muted-foreground">PTP capture rate</p>
          <p className="tnum mt-0.5 font-display text-xl font-semibold text-success">{fmtPct(stats.rate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-muted-foreground">Avg handle time</p>
          <p className="tnum mt-0.5 font-display text-xl font-semibold">{fmtDuration(stats.avg)}</p>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Bot-eligible queue</p>
            <p className="tnum mt-0.5 font-display text-xl font-semibold">{botLane.length}</p>
          </div>
          <Button size="sm" loading={campaignBusy} onClick={launch} disabled={botLane.length === 0}>
            {!campaignBusy && <Play className="h-3.5 w-3.5" />} Launch campaign
          </Button>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-violet-500" /> Ava · Automated Collection Calls</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Full transcripts retained for 24 months · click a call to review</p>
          </div>
          <Badge variant="violet">voice-llm v3 · en-US</Badge>
        </CardHeader>
        <CardContent>
          {botCalls.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No bot calls yet" description="Launch a campaign to send Ava to the low-propensity queue." />
          ) : (
            <div className="divide-y divide-border">
              {botCalls.map((c) => {
                const meta = BOT_OUTCOME_META[c.outcome];
                return (
                  <button key={c.id} onClick={() => setOpenCall(c)} className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/60">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", c.outcome === "PTP_CAPTURED" ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {c.outcome === "NO_ANSWER" ? <Voicemail className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{c.customer} <span className="tnum ml-1 font-normal text-muted-foreground">{c.accountId}</span></p>
                      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Timer className="h-3 w-3" /> {fmtDuration(c.durationSec)} · {timeAgo(c.at)}</p>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openCall !== null} onClose={() => setOpenCall(null)} title="Call transcript" description={openCall ? `${openCall.customer} · ${openCall.id} · ${fmtDuration(openCall.durationSec)}` : undefined} wide>
        {openCall && (
          <div className="space-y-2.5">
            {openCall.transcript.map((t, i) => (
              <div key={i} className={cn("flex", t.speaker === "BOT" ? "justify-start" : "justify-end")}>
                <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed", t.speaker === "BOT" ? "rounded-tl-sm border border-border bg-panel" : "rounded-tr-sm bg-primary/10 text-foreground")}>
                  <p className={cn("mb-0.5 text-[9px] font-bold uppercase tracking-wider", t.speaker === "BOT" ? "text-violet-500" : "text-primary")}>{t.speaker === "BOT" ? "Ava · AI" : "Customer"}</p>
                  {t.text}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <Badge variant={BOT_OUTCOME_META[openCall.outcome].variant}>{BOT_OUTCOME_META[openCall.outcome].label}</Badge>
              <p className="text-[10px] text-muted-foreground">Confidence 0.94 · sentiment {openCall.outcome === "REFUSED" ? "negative" : "neutral-positive"} · QA sampled</p>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
