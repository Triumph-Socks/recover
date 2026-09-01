import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bot, CircleDollarSign, Info, MapPin, Mail, Phone, StickyNote, UserCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useData } from "../store";
import { addNoteAction, recordPaymentAction, setPTPAction } from "../lib/actions";
import { BUCKET_COLORS, cn, fmtMoney, fmtMoneyCompact, fmtPct, timeAgo } from "../lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, LANE_META, Select, STATUS_META, Tabs, Textarea } from "../components/ui";
import { Avatar, PageContainer } from "../components/layout";

const METHODS = ["ACH Transfer", "Card on File", "Wire", "Direct Debit", "Cash @ Branch"];

export function Customer360Page() {
  const { cif } = useParams<{ cif: string }>();
  const { accounts, payments, activity, users } = useData();

  const list = useMemo(() => accounts.filter((a) => a.cif === cif), [accounts, cif]);
  const customer = list[0];

  const totals = useMemo(() => {
    const exposure = list.reduce((s, a) => s + a.outstanding, 0);
    const maxDpd = list.reduce((m, a) => Math.max(m, a.dpd), 0);
    const avgScore = list.length ? Math.round(list.reduce((s, a) => s + a.score, 0) / list.length) : 0;
    const worst = list.reduce((w, a) => (a.bucket > w ? a.bucket : w), "CUR" as string);
    return { exposure, maxDpd, avgScore, worst };
  }, [list]);

  const timeline = useMemo(() => {
    const ids = new Set(list.map((a) => a.id));
    const name = customer?.customer ?? "";
    const pays = payments
      .filter((p) => ids.has(p.accountId))
      .slice(0, 6)
      .map((p) => ({ id: p.id, at: p.date, icon: <CircleDollarSign className="h-3.5 w-3.5 text-success" />, text: `Payment of ${fmtMoney(p.amount)} via ${p.method}`, sub: p.agentName ?? "System" }));
    const acts = activity
      .filter((a) => [...ids].some((id) => a.message.includes(id)) || (name && a.message.includes(name)))
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        at: a.at,
        icon: a.type === "PAYMENT" ? <CircleDollarSign className="h-3.5 w-3.5 text-success" /> : a.type === "BOT" ? <Bot className="h-3.5 w-3.5 text-violet-500" /> : a.type === "PTP" ? <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Info className="h-3.5 w-3.5 text-muted-foreground" />,
        text: a.message,
        sub: a.actor,
      }));
    return [...pays, ...acts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  }, [list, payments, activity, customer]);

  if (!customer) {
    return (
      <PageContainer>
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Customer not found"
          description={`No accounts are linked to CIF “${cif}”. It may have been merged or archived.`}
          action={<Link to="/portfolio"><Button variant="outline" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> Back to portfolio</Button></Link>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link to="/portfolio" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Portfolio
      </Link>

      {/* header */}
      <Card className="anim-fade-up overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-panel px-5 py-4">
          <Avatar name={customer.customer} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold tracking-tight">{customer.customer}</h2>
              <Badge variant="blue">{totals.worst === "CUR" ? "Current" : `Worst: ${totals.worst}`}</Badge>
              <Badge variant="outline">{customer.segment}</Badge>
            </div>
            <p className="tnum mt-0.5 text-xs text-muted-foreground">{customer.cif} · customer since {new Date(customer.openedAt).getFullYear()}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-5">
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total exposure</p>
              <p className="tnum font-display text-lg font-semibold text-destructive">{fmtMoney(totals.exposure)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Accounts</p>
              <p className="tnum font-display text-lg font-semibold">{list.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Max DPD</p>
              <p className="tnum font-display text-lg font-semibold">{totals.maxDpd}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">PTP score</p>
              <p className={cn("tnum font-display text-lg font-semibold", totals.avgScore >= 72 ? "text-success" : totals.avgScore >= 48 ? "text-primary" : "text-warning")}>{totals.avgScore}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1.5 px-5 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>
          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {customer.city}</span>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* left: exposures + timeline */}
        <div className="space-y-3 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Consolidated Exposures</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">All products under {customer.cif}</p></CardHeader>
            <CardContent className="pt-1">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3">Product</th><th className="py-2 pr-3">Account</th><th className="py-2 pr-3 text-right">Outstanding</th><th className="py-2 pr-3">DPD</th><th className="py-2 pr-3">Status</th><th className="py-2">Lane</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-3 text-xs font-medium">{a.product}</td>
                        <td className="tnum py-2.5 pr-3 text-xs text-muted-foreground">{a.id}</td>
                        <td className="tnum py-2.5 pr-3 text-right text-[13px] font-semibold">{fmtMoney(a.outstanding)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="flex items-center gap-1.5 text-xs font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLORS[a.bucket] }} />{a.dpd}</span>
                        </td>
                        <td className="py-2.5 pr-3"><Badge variant={STATUS_META[a.status]?.variant ?? "neutral"}>{STATUS_META[a.status]?.label ?? a.status}</Badge></td>
                        <td className="py-2.5">{a.lane ? <Badge variant={LANE_META[a.lane].variant}>{LANE_META[a.lane].label}</Badge> : <span className="text-[11px] text-muted-foreground">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Interaction Timeline</CardTitle></CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No recorded interactions yet.</p>
              ) : (
                <div className="relative space-y-0">
                  {timeline.map((t, i) => (
                    <div key={t.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < timeline.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-border" />}
                      <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-panel">{t.icon}</span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-xs leading-snug">{t.text}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{t.sub} · {timeAgo(t.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* right: actions + scoring */}
        <div className="space-y-3">
          <ActionPanel accounts={list} />
          <ScoreCard customer={customer} />
        </div>
      </div>
    </PageContainer>
  );
}

/* ---------------- actions panel ---------------- */

function ActionPanel({ accounts }: { accounts: import("../lib/types").Account[] }) {
  const [tab, setTab] = useState("payment");
  const actionable = accounts.filter((a) => a.outstanding > 0 && a.status !== "WRITTEN_OFF" && a.status !== "PAID");
  const [accountId, setAccountId] = useState(actionable[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [ptpDate, setPtpDate] = useState("");
  const [ptpAmount, setPtpAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = actionable.find((a) => a.id === accountId);

  const submit = async () => {
    setBusy(true);
    if (tab === "payment") {
      const res = await recordPaymentAction({ accountId, amount: Number(amount), method });
      if (res.ok) { toast.success("Payment recorded", { description: `${fmtMoney(res.data.amount)} posted to ${res.data.accountId}` }); setAmount(""); }
      else toast.error("Payment failed", { description: res.error });
    } else if (tab === "ptp") {
      const res = await setPTPAction({ accountId, date: ptpDate ? new Date(ptpDate + "T12:00:00").toISOString() : "", amount: Number(ptpAmount) });
      if (res.ok) { toast.success("Promise to pay saved", { description: `${selected?.customer} committed ${fmtMoney(Number(ptpAmount))}` }); setPtpAmount(""); setPtpDate(""); }
      else toast.error("PTP failed", { description: res.error });
    } else {
      const res = await addNoteAction({ accountId, note, customer: selected?.customer ?? "" });
      if (res.ok) { toast.success("Note added to timeline"); setNote(""); }
      else toast.error("Note failed", { description: res.error });
    }
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <Tabs value={tab} onChange={setTab} items={[{ value: "payment", label: "Payment" }, { value: "ptp", label: "PTP" }, { value: "note", label: "Note" }]} />
      </CardHeader>
      <CardContent>
        {actionable.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No actionable balances on this CIF.</p>
        ) : (
          <div className="space-y-3.5">
            <div>
              <Label>Account</Label>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {actionable.map((a) => <option key={a.id} value={a.id}>{a.product} · {a.id} · {fmtMoney(a.outstanding)}</option>)}
              </Select>
            </div>

            {tab === "payment" && (
              <>
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={selected ? `Up to ${fmtMoney(selected.outstanding)}` : "0"} />
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select>
                </div>
              </>
            )}
            {tab === "ptp" && (
              <>
                <div>
                  <Label>Promise date</Label>
                  <Input type="date" value={ptpDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPtpDate(e.target.value)} />
                </div>
                <div>
                  <Label>Promised amount</Label>
                  <Input type="number" min="1" value={ptpAmount} onChange={(e) => setPtpAmount(e.target.value)} placeholder="0" />
                </div>
              </>
            )}
            {tab === "note" && (
              <div>
                <Label>Note</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call summary, dispute details, skip trace info…" />
              </div>
            )}

            <Button className="w-full" loading={busy} onClick={submit} variant={tab === "payment" ? "success" : "primary"}>
              {tab === "payment" ? "Record payment" : tab === "ptp" ? "Save promise" : "Add note"}
            </Button>
            {selected && (
              <p className="text-center text-[10px] text-muted-foreground">Posting to {selected.id} · {selected.product} · posted instantly to the ledger</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- score card ---------------- */

function ScoreCard({ customer }: { customer: import("../lib/types").Account }) {
  const f = customer.factors;
  const rows = [
    { label: "Delinquency age", v: f.dpd, color: "bg-primary" },
    { label: "Balance weight", v: f.balance, color: "bg-blue-400" },
    { label: "Payment behavior", v: f.behavior, color: "bg-success" },
    { label: "Contact recency", v: f.recency, color: "bg-warning" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Propensity to Pay</CardTitle>
        <span className={cn("tnum rounded-md px-2 py-1 font-display text-lg font-semibold", customer.score >= 72 ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400" : customer.score >= 48 ? "bg-blue-600/10 text-blue-600 dark:text-blue-400" : "bg-amber-600/10 text-amber-600 dark:text-amber-400")}>{customer.score}</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="tnum font-semibold">{Math.round(r.v * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("anim-bar h-full rounded-full", r.color)} style={{ width: `${r.v * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-panel px-3 py-2.5">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-snug text-muted-foreground">
            {customer.score >= 72
              ? "High propensity — prioritized for senior agent outreach with settlement authority."
              : customer.score >= 48
                ? "Moderate propensity — standard queue with weekly cadence."
                : "Low propensity — routed to AI Voice Bot for low-cost nurturing."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
