import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateSeed } from "../data/seed";
import type {
  Account,
  Activity,
  ActivityType,
  AllocationSummary,
  BotCall,
  BotOutcome,
  CallLog,
  CallOutcome,
  Lane,
  Payment,
  PaymentChannel,
  Role,
  ScoreWeights,
  User,
  WriteOff,
} from "../lib/types";
import { LEGAL_STAGES } from "../lib/types";
import { bucketFromDpd, scoreAccount, todayISO, uid } from "../lib/utils";

/* ================= AUTH ================= */

interface AuthState {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: "omni-auth" }
  )
);

/* ================= UI ================= */

interface UIState {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  setTheme: (t: "light" | "dark") => void;
  toggleSidebar: () => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "omni-ui" }
  )
);

/* ================= DATA ================= */

const seed = generateSeed();

export interface DataState {
  users: User[];
  accounts: Account[];
  payments: Payment[];
  agencies: ReturnType<typeof generateSeed>["agencies"];
  legalCases: ReturnType<typeof generateSeed>["legalCases"];
  writeOffs: WriteOff[];
  botCalls: BotCall[];
  callLogs: CallLog[];
  activity: Activity[];
  weights: ScoreWeights;
  bands: { top: number; standard: number };
  lastAllocation: AllocationSummary | null;

  pushActivity: (type: ActivityType, message: string, actor: string) => void;
  recordPayment: (p: { accountId: string; amount: number; method: string; channel: PaymentChannel; actorId: string | null; actorName: string }) => Payment | null;
  setPTP: (p: { accountId: string; date: string; amount: number; actorName: string }) => void;
  resolvePTP: (p: { accountId: string; kept: boolean; actorName: string }) => void;
  logCall: (p: { accountId: string; durationSec: number; outcome: CallOutcome; notes: string; agentId: string; agentName: string }) => void;
  addNote: (p: { accountId: string; note: string; actorName: string; customer: string }) => void;
  runAllocation: () => AllocationSummary;
  assignAgencyBatch: (p: { accountIds: string[]; agencyId: string; actorName: string }) => void;
  fileLegal: (p: { accountId: string; actorName: string }) => string;
  advanceLegal: (p: { caseId: string; actorName: string; note: string }) => void;
  submitWriteOff: (p: { accountId: string; reason: string; actorName: string; role: Role }) => void;
  reviewWriteOff: (p: { id: string; approve: boolean; comment: string; actorName: string; role: Role }) => { ok: boolean; error?: string };
  addBotCalls: (calls: BotCall[], actorName: string) => void;
  updateUserRole: (userId: string, role: Role) => void;
  toggleUserActive: (userId: string) => void;
  setWeights: (w: ScoreWeights) => void;
  setBands: (b: { top: number; standard: number }) => void;
  resetData: () => void;
}

const withActivity = (list: Activity[], type: ActivityType, message: string, actor: string): Activity[] =>
  [{ id: uid("ACT"), at: todayISO(), type, message, actor }, ...list].slice(0, 80);

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      ...seed,
      lastAllocation: null,

      pushActivity: (type, message, actor) =>
        set((s) => ({ activity: withActivity(s.activity, type, message, actor) })),

      recordPayment: ({ accountId, amount, method, channel, actorId, actorName }) => {
        const acc = get().accounts.find((a) => a.id === accountId);
        if (!acc) return null;
        const payment: Payment = {
          id: uid("PAY").toUpperCase(),
          accountId,
          cif: acc.cif,
          customer: acc.customer,
          product: acc.product,
          amount,
          date: todayISO(),
          method,
          channel,
          agentId: actorId,
          agentName: actorName,
        };
        set((s) => {
          const remaining = Math.max(0, acc.outstanding - amount);
          const accounts = s.accounts.map((a) =>
            a.id === accountId
              ? {
                  ...a,
                  outstanding: remaining,
                  dpd: remaining === 0 ? 0 : a.dpd,
                  bucket: remaining === 0 ? ("CUR" as const) : a.bucket,
                  status: remaining === 0 ? ("PAID" as const) : a.status,
                  lane: remaining === 0 ? null : a.lane,
                  lastContact: todayISO(),
                }
              : a
          );
          return {
            accounts,
            payments: [payment, ...s.payments],
            activity: withActivity(s.activity, "PAYMENT", `${acc.customer} paid $${amount.toLocaleString()} on ${acc.product} (${method})`, actorName),
          };
        });
        return payment;
      },

      setPTP: ({ accountId, date, amount, actorName }) =>
        set((s) => {
          const acc = s.accounts.find((a) => a.id === accountId);
          return {
            accounts: s.accounts.map((a) =>
              a.id === accountId ? { ...a, ptp: { date, amount, kept: null }, status: "PTP" as const, lastContact: todayISO() } : a
            ),
            activity: acc
              ? withActivity(s.activity, "PTP", `${acc.customer} promised $${amount.toLocaleString()} by ${new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, actorName)
              : s.activity,
          };
        }),

      resolvePTP: ({ accountId, kept, actorName }) =>
        set((s) => {
          const acc = s.accounts.find((a) => a.id === accountId);
          return {
            accounts: s.accounts.map((a) =>
              a.id === accountId
                ? { ...a, ptp: a.ptp ? { ...a.ptp, kept } : null, status: kept ? ("IN_COLLECTIONS" as const) : ("BROKEN_PTP" as const) }
                : a
            ),
            activity: acc
              ? withActivity(s.activity, "PTP", `PTP ${kept ? "kept" : "broken"} — ${acc.customer}`, actorName)
              : s.activity,
          };
        }),

      logCall: ({ accountId, durationSec, outcome, notes, agentId, agentName }) =>
        set((s) => {
          const acc = s.accounts.find((a) => a.id === accountId);
          if (!acc) return s;
          const log: CallLog = { id: uid("CALL").toUpperCase(), accountId, customer: acc.customer, agentId, agentName, at: todayISO(), durationSec, outcome, notes };
          const connected = outcome === "CONNECTED_PTP" || outcome === "CONNECTED_NO_PTP";
          return {
            callLogs: [log, ...s.callLogs],
            accounts: s.accounts.map((a) =>
              a.id === accountId
                ? {
                    ...a,
                    lastContact: todayISO(),
                    attempts: a.attempts + 1,
                    status: connected && a.status === "NEW" ? ("IN_COLLECTIONS" as const) : a.status,
                  }
                : a
            ),
            activity: withActivity(s.activity, "CALL", `${agentName} called ${acc.customer} — ${outcome.replace(/_/g, " ").toLowerCase()} (${Math.floor(durationSec / 60)}m ${durationSec % 60}s)`, agentName),
          };
        }),

      addNote: ({ accountId, note, actorName, customer }) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, lastContact: a.lastContact } : a)),
          activity: withActivity(s.activity, "SYSTEM", `Note on ${customer} (${accountId}): “${note}”`, actorName),
        })),

      runAllocation: () => {
        const started = performance.now();
        const { weights, bands, users } = get();
        const agents = users.filter((u) => u.role === "AGENT" && u.active);
        let ai = 0;
        const counts: Record<Lane, number> = { TOP_AGENT: 0, STANDARD: 0, VOICE_BOT: 0, LEGAL: 0 };
        let value = 0;
        let scored = 0;

        const accounts = get().accounts.map((a) => {
          const isActive = ["NEW", "IN_COLLECTIONS", "PTP", "BROKEN_PTP"].includes(a.status);
          if (!isActive) return { ...a, lane: null, ownerId: a.ownerId };
          const sa = scoreAccount(a, weights);
          scored++;
          value += sa.outstanding;
          let lane: Lane;
          if (sa.dpd >= 120 && sa.outstanding >= 40000) lane = "LEGAL";
          else if (sa.score >= bands.top) lane = "TOP_AGENT";
          else if (sa.score >= bands.standard) lane = "STANDARD";
          else lane = "VOICE_BOT";
          counts[lane]++;
          const owner = lane === "TOP_AGENT" || lane === "STANDARD" ? agents[ai++ % Math.max(1, agents.length)].id : null;
          return { ...sa, lane, ownerId: owner };
        });

        const summary: AllocationSummary = {
          scored,
          topAgent: counts.TOP_AGENT,
          standard: counts.STANDARD,
          voiceBot: counts.VOICE_BOT,
          legal: counts.LEGAL,
          valueAllocated: value,
          durationMs: Math.round(performance.now() - started),
        };
        set((s) => ({
          accounts,
          lastAllocation: summary,
          activity: withActivity(s.activity, "ASSIGN", `Allocation engine routed ${scored} accounts — ${counts.TOP_AGENT} top-agent · ${counts.STANDARD} standard · ${counts.VOICE_BOT} voice-bot · ${counts.LEGAL} legal`, "AI Engine"),
        }));
        return summary;
      },

      assignAgencyBatch: ({ accountIds, agencyId, actorName }) =>
        set((s) => {
          const agency = s.agencies.find((a) => a.id === agencyId);
          const ids = new Set(accountIds);
          const value = s.accounts.filter((a) => ids.has(a.id)).reduce((sum, a) => sum + a.outstanding, 0);
          return {
            accounts: s.accounts.map((a) => (ids.has(a.id) ? { ...a, agencyId, status: "AGENCY" as const, lane: null, ownerId: null } : a)),
            agencies: s.agencies.map((a) => (a.id === agencyId ? { ...a, assignedCount: a.assignedCount + accountIds.length, placed: a.placed + value } : a)),
            activity: withActivity(s.activity, "ASSIGN", `${accountIds.length} accounts ($${value.toLocaleString()}) placed with ${agency?.name ?? "agency"}`, actorName),
          };
        }),

      fileLegal: ({ accountId, actorName }) => {
        const acc = get().accounts.find((a) => a.id === accountId);
        const id = `LC-2024-${Math.floor(400 + Math.random() * 500)}`;
        if (!acc) return id;
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, status: "LEGAL" as const, legalCaseId: id, lane: null } : a)),
          legalCases: [
            {
              id,
              accountId,
              customer: acc.customer,
              product: acc.product,
              amount: acc.outstanding,
              stage: 0,
              filedOn: todayISO(),
              nextDate: new Date(Date.now() + 14 * 86400000).toISOString(),
              counsel: "Pending assignment",
              history: [{ at: todayISO(), actor: actorName, note: `Case opened — demand notice issued to ${acc.customer}.` }],
            },
            ...s.legalCases,
          ],
          activity: withActivity(s.activity, "LEGAL", `Legal case ${id} filed against ${acc.customer} ($${acc.outstanding.toLocaleString()})`, actorName),
        }));
        return id;
      },

      advanceLegal: ({ caseId, actorName, note }) =>
        set((s) => {
          const c = s.legalCases.find((x) => x.id === caseId);
          if (!c) return s;
          const stage = Math.min(c.stage + 1, LEGAL_STAGES.length - 1);
          return {
            legalCases: s.legalCases.map((x) =>
              x.id === caseId
                ? { ...x, stage, history: [...x.history, { at: todayISO(), actor: actorName, note: note || `Advanced to ${LEGAL_STAGES[stage]}` }] }
                : x
            ),
            activity: withActivity(s.activity, "LEGAL", `${caseId} (${c.customer}) advanced to ${LEGAL_STAGES[stage]}`, actorName),
          };
        }),

      submitWriteOff: ({ accountId, reason, actorName, role }) =>
        set((s) => {
          const acc = s.accounts.find((a) => a.id === accountId);
          if (!acc) return s;
          const wo: WriteOff = {
            id: `WO-24-${Math.floor(200 + Math.random() * 700)}`,
            accountId,
            customer: acc.customer,
            product: acc.product,
            amount: acc.outstanding,
            reason,
            stage: "RECOMMENDED",
            history: [{ at: todayISO(), actor: actorName, role, action: "Recommended write-off", comment: reason }],
          };
          return {
            writeOffs: [wo, ...s.writeOffs],
            activity: withActivity(s.activity, "WRITEOFF", `${wo.id} submitted for ${acc.customer} — $${acc.outstanding.toLocaleString()}`, actorName),
          };
        }),

      reviewWriteOff: ({ id, approve, comment, actorName, role }) => {
        const wo = get().writeOffs.find((w) => w.id === id);
        if (!wo) return { ok: false, error: "Write-off request not found" };
        let next: WriteOff["stage"];
        if (!approve) next = "REJECTED";
        else if (wo.stage === "RECOMMENDED" || wo.stage === "MANAGER_REVIEW") next = "FINAL_APPROVAL";
        else if (wo.stage === "FINAL_APPROVAL") next = "WRITTEN_OFF";
        else return { ok: false, error: "This request is already closed" };

        const action = !approve ? "Rejected" : next === "FINAL_APPROVAL" ? "Manager approved" : "Final approval — written off";
        set((s) => ({
          writeOffs: s.writeOffs.map((w) =>
            w.id === id
              ? { ...w, stage: next, history: [...w.history, { at: todayISO(), actor: actorName, role, action, comment }] }
              : w
          ),
          accounts:
            next === "WRITTEN_OFF"
              ? s.accounts.map((a) => (a.id === wo.accountId ? { ...a, status: "WRITTEN_OFF" as const, lane: null, outstanding: a.outstanding } : a))
              : s.accounts,
          activity: withActivity(s.activity, "WRITEOFF", `${id} ${action.toLowerCase()} — ${wo.customer}`, actorName),
        }));
        return { ok: true };
      },

      addBotCalls: (calls, actorName) => {
        const ptps = calls.filter((c) => c.outcome === "PTP_CAPTURED").length;
        set((s) => ({
          botCalls: [...calls, ...s.botCalls],
          accounts: s.accounts.map((a) => {
            const call = calls.find((c) => c.accountId === a.id);
            if (!call) return a;
            return {
              ...a,
              lastContact: call.at,
              attempts: a.attempts + 1,
              ptp: call.outcome === "PTP_CAPTURED" ? { date: new Date(Date.now() + 5 * 86400000).toISOString(), amount: Math.round(a.outstanding * 0.15), kept: null } : a.ptp,
              status: call.outcome === "PTP_CAPTURED" ? ("PTP" as const) : a.status,
            };
          }),
          activity: withActivity(s.activity, "BOT", `AI Voice Bot completed ${calls.length} outbound attempts — ${ptps} PTPs captured`, actorName),
        }));
      },

      updateUserRole: (userId, role) =>
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, role } : u)) })),

      toggleUserActive: (userId) =>
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)) })),

      setWeights: (weights) => set({ weights }),
      setBands: (bands) => set({ bands }),
      resetData: () => set({ ...generateSeed(), lastAllocation: null }),
    }),
    { name: "omni-data", version: 4 }
  )
);

/* ================= selectors ================= */

export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useStateNow(intervalMs);
  return now;
}

import { useEffect, useState } from "react";
function useStateNow(intervalMs: number): [number, (n: number) => void] {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return [now, setNow];
}

export type { BotOutcome };
