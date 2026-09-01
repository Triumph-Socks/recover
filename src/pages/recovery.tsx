import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, FileMinus2, FilePlus2, Scale, Send, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useData } from "../store";
import { advanceLegalAction, assignAgencyAction, fileLegalAction, reviewWriteOffAction, submitWriteOffAction } from "../lib/actions";
import { LEGAL_STAGES } from "../lib/types";
import type { LegalCase, WriteOff } from "../lib/types";
import { cn, fmtDate, fmtMoney, fmtMoneyCompact, fmtPct, timeAgo } from "../lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Label, Progress, Select, Textarea } from "../components/ui";
import { PageContainer } from "../components/layout";

/* ================= AGENCIES ================= */

export function AgenciesPage() {
  const user = useAuth((s) => s.user)!;
  const { agencies, accounts } = useData();
  const canPlace = user.role === "MANAGER" || user.role === "SUPER_ADMIN";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agencyId, setAgencyId] = useState(agencies[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () =>
      accounts
        .filter((a) => !["AGENCY", "LEGAL", "WRITTEN_OFF", "PAID"].includes(a.status) && a.dpd >= 60 && a.outstanding > 0)
        .sort((a, b) => b.dpd - a.dpd)
        .slice(0, 30),
    [accounts]
  );

  const selectedValue = candidates.filter((a) => selected.has(a.id)).reduce((s, a) => s + a.outstanding, 0);

  const place = async () => {
    setBusy(true);
    const res = await assignAgencyAction({ accountIds: [...selected], agencyId });
    setBusy(false);
    if (res.ok) {
      toast.success("Batch placed", { description: `${res.data} accounts handed to ${agencies.find((a) => a.id === agencyId)?.name}.` });
      setSelected(new Set());
    } else toast.error("Placement failed", { description: res.error });
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const visibleAgencies = user.role === "AGENCY" ? agencies.filter((a) => a.id === "ag-1") : agencies;

  return (
    <PageContainer>
      <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {visibleAgencies.map((ag) => {
          const rate = ag.placed ? (ag.recovered / ag.placed) * 100 : 0;
          return (
            <Card key={ag.id} className="p-4">
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-violet-600/10 text-violet-600 dark:text-violet-400"><Building2 className="h-4 w-4" /></span>
                <Badge variant={ag.status === "ACTIVE" ? "emerald" : "amber"}>{ag.status === "ACTIVE" ? "Active" : "On hold"}</Badge>
              </div>
              <p className="mt-2.5 font-display text-sm font-semibold">{ag.name}</p>
              <p className="text-[11px] text-muted-foreground">{ag.contact} · {ag.commissionPct}% commission</p>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Recovery rate</span>
                  <span className="tnum font-semibold text-success">{fmtPct(rate)}</span>
                </div>
                <Progress value={rate} tone="success" />
              </div>
              <div className="tnum mt-3 flex justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                <span>{fmtMoneyCompact(ag.recovered)} / {fmtMoneyCompact(ag.placed)}</span>
                <span>{ag.assignedCount} open</span>
              </div>
            </Card>
          );
        })}
      </div>

      {canPlace && (
        <Card className="mt-3">
          <CardHeader>
            <div>
              <CardTitle>Batch Placement</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Delinquent 60+ DPD accounts eligible for external placement</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="h-8 w-[190px] text-xs">
                {agencies.filter((a) => a.status === "ACTIVE").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Button size="sm" loading={busy} disabled={selected.size === 0} onClick={place}>
                <Send className="h-3.5 w-3.5" /> Place {selected.size > 0 ? `${selected.size} · ${fmtMoneyCompact(selectedValue)}` : "batch"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={selected.size === candidates.length && candidates.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? new Set(candidates.map((a) => a.id)) : new Set())}
                        className="h-3.5 w-3.5 accent-blue-600"
                      />
                    </th>
                    <th className="py-2 pr-3">Account</th><th className="py-2 pr-3">Product</th><th className="py-2 pr-3">DPD</th><th className="py-2 pr-3">Bucket</th><th className="py-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((a) => (
                    <tr key={a.id} onClick={() => toggle(a.id)} className={cn("cursor-pointer border-b border-border transition-colors last:border-0", selected.has(a.id) ? "bg-primary/5" : "hover:bg-muted/60")}>
                      <td className="py-2 pr-3">
                        <input type="checkbox" aria-label={`Select ${a.id}`} checked={selected.has(a.id)} onChange={() => toggle(a.id)} onClick={(e) => e.stopPropagation()} className="h-3.5 w-3.5 accent-blue-600" />
                      </td>
                      <td className="py-2 pr-3"><p className="text-xs font-semibold">{a.customer}</p><p className="tnum text-[10px] text-muted-foreground">{a.id} · {a.cif}</p></td>
                      <td className="py-2 pr-3 text-xs">{a.product}</td>
                      <td className="tnum py-2 pr-3 text-xs font-semibold text-destructive">{a.dpd}</td>
                      <td className="py-2 pr-3"><Badge variant="outline">{a.bucket}</Badge></td>
                      <td className="tnum py-2 text-right text-xs font-semibold">{fmtMoney(a.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {user.role === "AGENCY" && (
        <Card className="mt-3">
          <CardHeader><CardTitle>Accounts Placed With You</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {accounts.filter((a) => a.agencyId === "ag-1").slice(0, 12).map((a) => (
                <Link to={`/customers/${a.cif}`} key={a.id} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/50">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1"><p className="text-xs font-semibold">{a.customer}</p><p className="tnum text-[10px] text-muted-foreground">{a.id} · {a.product}</p></div>
                  <Badge variant="outline">{a.dpd} DPD</Badge>
                  <span className="tnum text-xs font-semibold">{fmtMoney(a.outstanding)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

/* ================= LEGAL ================= */

export function LegalPage() {
  const user = useAuth((s) => s.user)!;
  const { legalCases, accounts } = useData();
  const [detail, setDetail] = useState<LegalCase | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [fileTarget, setFileTarget] = useState("");
  const [fileReason, setFileReason] = useState("Demand notice — 30 days to cure before suit");
  const [fileBusy, setFileBusy] = useState(false);

  const candidates = accounts.filter((a) => a.dpd >= 90 && !a.legalCaseId && a.outstanding > 0 && !["WRITTEN_OFF", "PAID"].includes(a.status));
  const byStage = LEGAL_STAGES.map((s, i) => ({ stage: s, count: legalCases.filter((c) => c.stage === i).length }));

  const advance = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await advanceLegalAction({ caseId: detail.id, note });
    setBusy(false);
    if (res.ok) {
      toast.success("Case advanced", { description: `${detail.id} moved to the next stage.` });
      setDetail(null);
      setNote("");
    } else toast.error("Update failed", { description: res.error });
  };

  const file = async () => {
    setFileBusy(true);
    const res = await fileLegalAction({ accountId: fileTarget });
    setFileBusy(false);
    if (res.ok) {
      toast.success("Case filed", { description: `${res.data} opened — demand notice issued.` });
      setFileOpen(false);
    } else toast.error("Filing failed", { description: res.error });
  };

  return (
    <PageContainer>
      {/* pipeline */}
      <div className="stagger mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {byStage.map((s, i) => (
          <Card key={s.stage} className="p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stage {i + 1}</p>
            <p className="mt-0.5 text-xs font-semibold">{s.stage}</p>
            <p className="tnum mt-1.5 font-display text-xl font-semibold">{s.count}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><Scale className="h-4 w-4 text-rose-500" /> Active Litigation</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{legalCases.length} cases · {fmtMoneyCompact(legalCases.reduce((s, c) => s + c.amount, 0))} under recovery</p>
          </div>
          <Button size="sm" onClick={() => setFileOpen(true)}><FilePlus2 className="h-3.5 w-3.5" /> File new case</Button>
        </CardHeader>
        <CardContent>
          {legalCases.length === 0 ? (
            <EmptyState icon={<Scale className="h-5 w-5" />} title="No active cases" description="File a case against a 90+ DPD account to begin litigation." />
          ) : (
            <div className="divide-y divide-border">
              {legalCases.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[13px] font-semibold">{c.customer} <span className="tnum ml-1 text-[10px] font-normal text-muted-foreground">{c.id}</span></p>
                    <p className="text-[11px] text-muted-foreground">{c.product} · counsel: {c.counsel}</p>
                  </div>
                  {/* stage dots */}
                  <div className="flex items-center gap-1" title={LEGAL_STAGES[c.stage]}>
                    {LEGAL_STAGES.map((s, i) => (
                      <span key={s} className={cn("h-1.5 w-6 rounded-full transition-colors", i <= c.stage ? (c.stage >= 3 ? "bg-success" : "bg-primary") : "bg-muted")} />
                    ))}
                  </div>
                  <Badge variant={c.stage >= 3 ? "emerald" : c.stage >= 1 ? "blue" : "amber"}>{LEGAL_STAGES[c.stage]}</Badge>
                  <span className="tnum w-24 text-right text-[13px] font-semibold">{fmtMoneyCompact(c.amount)}</span>
                  <span className="tnum hidden w-24 text-right text-[11px] text-muted-foreground md:block">next {fmtDate(c.nextDate)}</span>
                  <Button variant="outline" size="sm" onClick={() => { setDetail(c); setNote(""); }} disabled={c.stage >= LEGAL_STAGES.length - 1}>
                    Advance <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* advance dialog */}
      <Dialog open={detail !== null} onClose={() => setDetail(null)} title={`Advance ${detail?.id ?? ""}`} description={detail ? `${detail.customer} · currently at “${LEGAL_STAGES[detail.stage]}” → next: “${LEGAL_STAGES[Math.min(detail.stage + 1, 4)]}”` : undefined}>
        <div className="space-y-3.5">
          <div>
            <Label>Progression note (required)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hearing outcome, settlement position, execution steps…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>Cancel</Button>
            <Button loading={busy} onClick={advance}><CheckCircle2 className="h-4 w-4" /> Advance stage</Button>
          </div>
        </div>
      </Dialog>

      {/* file dialog */}
      <Dialog open={fileOpen} onClose={() => setFileOpen(false)} title="File new legal case" description={`${candidates.length} accounts eligible (90+ DPD, no active case)`}>
        <div className="space-y-3.5">
          <div>
            <Label>Account</Label>
            <Select value={fileTarget} onChange={(e) => setFileTarget(e.target.value)}>
              <option value="">Select an account…</option>
              {candidates.slice(0, 40).map((a) => <option key={a.id} value={a.id}>{a.customer} · {a.id} · {fmtMoney(a.outstanding)} · {a.dpd} DPD</option>)}
            </Select>
          </div>
          <div>
            <Label>Initial note</Label>
            <Textarea value={fileReason} onChange={(e) => setFileReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFileOpen(false)}>Cancel</Button>
            <Button loading={fileBusy} disabled={!fileTarget} onClick={file}><FilePlus2 className="h-4 w-4" /> Open case</Button>
          </div>
        </div>
      </Dialog>
    </PageContainer>
  );
}

/* ================= WRITE-OFFS ================= */

const WO_STEPS = ["Recommended", "Manager review", "Final approval", "Written off"];

function woProgress(w: WriteOff): { done: number; rejected: boolean } {
  if (w.stage === "REJECTED") return { done: 0, rejected: true };
  if (w.stage === "RECOMMENDED") return { done: 1, rejected: false };
  if (w.stage === "MANAGER_REVIEW") return { done: 1, rejected: false };
  if (w.stage === "FINAL_APPROVAL") return { done: 2, rejected: false };
  return { done: 4, rejected: false };
}

const WO_BADGE: Record<WriteOff["stage"], { label: string; variant: "blue" | "amber" | "violet" | "emerald" | "rose" }> = {
  RECOMMENDED: { label: "Awaiting manager", variant: "blue" },
  MANAGER_REVIEW: { label: "Manager review", variant: "amber" },
  FINAL_APPROVAL: { label: "Awaiting final sign-off", variant: "violet" },
  WRITTEN_OFF: { label: "Written off", variant: "emerald" },
  REJECTED: { label: "Rejected", variant: "rose" },
};

export function WriteOffsPage() {
  const user = useAuth((s) => s.user)!;
  const { writeOffs, accounts } = useData();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [newBusy, setNewBusy] = useState(false);

  const candidates = accounts.filter((a) => a.dpd >= 120 && a.outstanding > 0 && a.status !== "WRITTEN_OFF" && !writeOffs.some((w) => w.accountId === a.id && !["REJECTED"].includes(w.stage)));

  const canReview = (w: WriteOff): boolean => {
    if (w.stage === "RECOMMENDED" || w.stage === "MANAGER_REVIEW") return user.role === "MANAGER" || user.role === "SUPER_ADMIN";
    if (w.stage === "FINAL_APPROVAL") return user.role === "SUPER_ADMIN";
    return false;
  };

  const review = async (id: string, approve: boolean) => {
    setBusyId(id);
    const res = await reviewWriteOffAction({ id, approve, comment: comments[id]?.trim() || (approve ? "Approved per policy" : "Rejected") });
    setBusyId(null);
    if (res.ok) toast.success(approve ? "Approval recorded" : "Request rejected", { description: `${id} moved to the next step in the matrix.` });
    else toast.error("Review failed", { description: res.error });
  };

  const submit = async () => {
    setNewBusy(true);
    const res = await submitWriteOffAction({ accountId: target, reason });
    setNewBusy(false);
    if (res.ok) {
      toast.success("Write-off submitted", { description: "Entered the approval matrix at step 1 of 3." });
      setNewOpen(false);
      setTarget("");
      setReason("");
    } else toast.error("Submission failed", { description: res.error });
  };

  const openCount = writeOffs.filter((w) => !["WRITTEN_OFF", "REJECTED"].includes(w.stage)).length;

  return (
    <PageContainer>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="stagger flex flex-wrap gap-2">
          <Badge variant="blue" className="px-2.5 py-1 text-xs">{openCount} in flight</Badge>
          <Badge variant="emerald" className="px-2.5 py-1 text-xs">{writeOffs.filter((w) => w.stage === "WRITTEN_OFF").length} written off</Badge>
          <Badge variant="rose" className="px-2.5 py-1 text-xs">{writeOffs.filter((w) => w.stage === "REJECTED").length} rejected</Badge>
          <Badge variant="outline" className="px-2.5 py-1 text-xs">{fmtMoneyCompact(writeOffs.reduce((s, w) => s + w.amount, 0))} total requested</Badge>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}><FileMinus2 className="h-3.5 w-3.5" /> Recommend write-off</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {writeOffs.map((w) => {
          const { done, rejected } = woProgress(w);
          const badge = WO_BADGE[w.stage];
          const reviewable = canReview(w);
          return (
            <Card key={w.id} className="anim-fade-up p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold">{w.customer} <span className="tnum ml-1 text-[10px] font-normal text-muted-foreground">{w.id} · {w.accountId}</span></p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{w.product} · {fmtMoney(w.amount)}</p>
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>

              {/* stepper */}
              <div className="mt-3.5 flex items-center gap-1.5">
                {WO_STEPS.map((s, i) => (
                  <div key={s} className="flex flex-1 flex-col gap-1">
                    <span className={cn("h-1.5 rounded-full transition-colors", rejected ? (i === 0 ? "bg-destructive" : "bg-muted") : i < done ? "bg-success" : "bg-muted")} />
                    <span className={cn("text-[9px] font-medium", rejected ? (i === 0 ? "text-destructive" : "text-muted-foreground/60") : i < done ? "text-success" : "text-muted-foreground/60")}>{s}</span>
                  </div>
                ))}
              </div>

              <p className="mt-3 rounded-md border border-border bg-panel px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Justification: </span>{w.reason}
              </p>

              {/* history */}
              <div className="mt-3 space-y-1.5">
                {w.history.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    {h.action.toLowerCase().includes("reject") ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />}
                    <p className="leading-snug text-muted-foreground"><span className="font-semibold text-foreground">{h.action}</span> — {h.actor} ({h.role.replace("_", " ").toLowerCase()}) · {timeAgo(h.at)}<br /><span className="italic">“{h.comment}”</span></p>
                  </div>
                ))}
              </div>

              {reviewable && (
                <div className="mt-3.5 border-t border-border pt-3">
                  <Label>Your review comment</Label>
                  <Textarea value={comments[w.id] ?? ""} onChange={(e) => setComments((c) => ({ ...c, [w.id]: e.target.value }))} placeholder="Required for the audit trail…" className="min-h-[56px]" />
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button size="sm" variant="success" loading={busyId === w.id} onClick={() => review(w.id, true)}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === w.id} onClick={() => review(w.id, false)}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {w.stage === "FINAL_APPROVAL" ? "Requires Super Admin" : "Requires Manager"}
                    </span>
                  </div>
                </div>
              )}
              {!reviewable && !["WRITTEN_OFF", "REJECTED"].includes(w.stage) && (
                <p className="mt-3 border-t border-border pt-2.5 text-[10px] text-muted-foreground">
                  Pending with {w.stage === "FINAL_APPROVAL" ? "Super Admin (final sign-off)" : "Collection Manager"} — you have read-only access at your role level.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* new request */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="Recommend write-off" description="Enters the 3-step approval matrix with full audit trail">
        <div className="space-y-3.5">
          <div>
            <Label>Eligible account (120+ DPD)</Label>
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select an account…</option>
              {candidates.slice(0, 40).map((a) => <option key={a.id} value={a.id}>{a.customer} · {a.id} · {fmtMoney(a.outstanding)} · {a.dpd} DPD</option>)}
            </Select>
          </div>
          <div>
            <Label>Justification (audited)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Debtor insolvent — no attachable assets after skip trace…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button loading={newBusy} disabled={!target} onClick={submit}><Send className="h-4 w-4" /> Submit to matrix</Button>
          </div>
        </div>
      </Dialog>
    </PageContainer>
  );
}
