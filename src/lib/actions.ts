import { z } from "zod";
import { useAuth, useData } from "../store";
import type { ActionReturn, AllocationSummary, Payment } from "./types";
import { delay } from "./utils";

/* ============================================================
   Mock Server-Action layer.
   Mirrors Next.js Server Actions: async, Zod-validated,
   simulated network latency, standardized error objects.
   ============================================================ */

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const issue = (e: z.ZodError): string => e.issues[0]?.message ?? "Invalid input";

/* ---------- auth ---------- */

export const LoginSchema = z.object({
  email: z.string().email("Enter a valid work email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function loginAction(input: unknown): Promise<ActionReturn<{ name: string; role: string }>> {
  await delay(650);
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const users = useData.getState().users;
    const user = users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase() && u.password === parsed.data.password
    );
    if (!user) return fail("Invalid credentials. Use one of the demo accounts below.");
    if (!user.active) return fail("This account has been deactivated. Contact your administrator.");
    useAuth.getState().login(user);
    return { ok: true, data: { name: user.name, role: user.role } };
  } catch {
    return fail("Authentication service unavailable. Try again.");
  }
}

/* ---------- payments & PTP ---------- */

export const PaymentSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z.coerce.number({ message: "Enter a payment amount" }).positive("Amount must be positive").max(50_000_000, "Exceeds single-payment limit"),
  method: z.string().min(1, "Select a method"),
});

export async function recordPaymentAction(input: unknown): Promise<ActionReturn<Payment>> {
  await delay(700);
  const parsed = PaymentSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    const payment = useData.getState().recordPayment({
      accountId: parsed.data.accountId,
      amount: Math.round(parsed.data.amount),
      method: parsed.data.method,
      channel: "DIALER",
      actorId: auth?.id ?? null,
      actorName: auth?.name ?? "System",
    });
    if (!payment) return fail("Account not found");
    return { ok: true, data: payment };
  } catch {
    return fail("Payment gateway timeout — no charge was made.");
  }
}

export const PTPSchema = z.object({
  accountId: z.string().min(1),
  date: z.string().min(1, "Pick a promise date"),
  amount: z.coerce.number({ message: "Enter the promised amount" }).positive("Amount must be positive"),
}).refine((v) => new Date(v.date).getTime() > Date.now() - 86400000, { message: "Promise date cannot be in the past", path: ["date"] });

export async function setPTPAction(input: unknown): Promise<ActionReturn<true>> {
  await delay(550);
  const parsed = PTPSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    useData.getState().setPTP({ ...parsed.data, actorName: auth?.name ?? "System" });
    return { ok: true, data: true };
  } catch {
    return fail("Could not save the promise-to-pay.");
  }
}

export const ResolvePTPSchema = z.object({
  accountId: z.string().min(1),
  kept: z.boolean(),
});

export async function resolvePTPAction(input: unknown): Promise<ActionReturn<true>> {
  await delay(450);
  const parsed = ResolvePTPSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    useData.getState().resolvePTP({ ...parsed.data, actorName: auth?.name ?? "System" });
    return { ok: true, data: true };
  } catch {
    return fail("Could not update the PTP.");
  }
}

export const NoteSchema = z.object({
  accountId: z.string().min(1),
  note: z.string().min(3, "Note is too short").max(280, "Note limited to 280 characters"),
  customer: z.string(),
});

export async function addNoteAction(input: unknown): Promise<ActionReturn<true>> {
  await delay(400);
  const parsed = NoteSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    useData.getState().addNote({ ...parsed.data, actorName: auth?.name ?? "System" });
    return { ok: true, data: true };
  } catch {
    return fail("Could not save the note.");
  }
}

/* ---------- dialer ---------- */

export const CallLogSchema = z.object({
  accountId: z.string().min(1),
  durationSec: z.number().int().min(1, "Call must last at least 1 second"),
  outcome: z.enum(["CONNECTED_PTP", "CONNECTED_NO_PTP", "NO_ANSWER", "VOICEMAIL", "WRONG_NUMBER"]),
  notes: z.string().max(300, "Notes limited to 300 characters"),
});

export async function logCallAction(input: unknown): Promise<ActionReturn<true>> {
  await delay(450);
  const parsed = CallLogSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    if (!auth) return fail("Session expired — sign in again.");
    useData.getState().logCall({
      ...parsed.data,
      agentId: auth.id,
      agentName: auth.name,
    });
    return { ok: true, data: true };
  } catch {
    return fail("Dialer logging failed.");
  }
}

/* ---------- allocation engine ---------- */

export async function runAllocationAction(): Promise<ActionReturn<AllocationSummary>> {
  await delay(900); // stage 1: scoring
  try {
    await delay(700); // stage 2: band computation
    const summary = useData.getState().runAllocation();
    await delay(500); // stage 3: assignment commit
    return { ok: true, data: summary };
  } catch {
    return fail("Allocation engine failed mid-run. No assignments were changed.");
  }
}

/* ---------- agencies ---------- */

export const AgencyBatchSchema = z.object({
  accountIds: z.array(z.string()).min(1, "Select at least one account to place"),
  agencyId: z.string().min(1, "Choose an agency"),
});

export async function assignAgencyAction(input: unknown): Promise<ActionReturn<number>> {
  await delay(750);
  const parsed = AgencyBatchSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    useData.getState().assignAgencyBatch({ ...parsed.data, actorName: auth?.name ?? "System" });
    return { ok: true, data: parsed.data.accountIds.length };
  } catch {
    return fail("Batch placement failed.");
  }
}

/* ---------- legal ---------- */

export const FileLegalSchema = z.object({ accountId: z.string().min(1, "Choose an account") });

export async function fileLegalAction(input: unknown): Promise<ActionReturn<string>> {
  await delay(650);
  const parsed = FileLegalSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    const id = useData.getState().fileLegal({ accountId: parsed.data.accountId, actorName: auth?.name ?? "System" });
    return { ok: true, data: id };
  } catch {
    return fail("Could not open the legal case.");
  }
}

export const AdvanceLegalSchema = z.object({
  caseId: z.string().min(1),
  note: z.string().min(4, "Add a short progression note"),
});

export async function advanceLegalAction(input: unknown): Promise<ActionReturn<true>> {
  await delay(600);
  const parsed = AdvanceLegalSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    useData.getState().advanceLegal({ ...parsed.data, actorName: auth?.name ?? "System" });
    return { ok: true, data: true };
  } catch {
    return fail("Stage update failed.");
  }
}

/* ---------- write-offs ---------- */

export const WriteOffSchema = z.object({
  accountId: z.string().min(1, "Choose an account"),
  reason: z.string().min(12, "Provide a justification (min 12 characters)"),
});

export async function submitWriteOffAction(input: unknown): Promise<ActionReturn<true>> {
  await delay(600);
  const parsed = WriteOffSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    if (!auth) return fail("Session expired.");
    useData.getState().submitWriteOff({ ...parsed.data, actorName: auth.name, role: auth.role });
    return { ok: true, data: true };
  } catch {
    return fail("Submission failed.");
  }
}

export const WriteOffReviewSchema = z.object({
  id: z.string().min(1),
  approve: z.boolean(),
  comment: z.string().min(4, "A review comment is required"),
});

export async function reviewWriteOffAction(input: unknown): Promise<ActionReturn<true>> {
  await delay(600);
  const parsed = WriteOffReviewSchema.safeParse(input);
  if (!parsed.success) return fail(issue(parsed.error));
  try {
    const auth = useAuth.getState().user;
    if (!auth) return fail("Session expired.");
    const res = useData.getState().reviewWriteOff({ ...parsed.data, actorName: auth.name, role: auth.role });
    if (!res.ok) return fail(res.error ?? "Review failed.");
    return { ok: true, data: true };
  } catch {
    return fail("Review failed.");
  }
}

/* ---------- bot campaign ---------- */

export async function runBotCampaignAction(accountIds: string[]): Promise<ActionReturn<{ calls: number; ptps: number }>> {
  await delay(1600);
  try {
    const { accounts, addBotCalls } = useData.getState();
    const auth = useAuth.getState().user;
    const targets = accounts.filter((a) => accountIds.includes(a.id)).slice(0, 8);
    if (targets.length === 0) return fail("No eligible accounts in the voice-bot lane.");
    const outcomes = ["PTP_CAPTURED", "CALLBACK_REQUESTED", "PTP_CAPTURED", "NO_ANSWER", "REFUSED", "PTP_CAPTURED", "CALLBACK_REQUESTED", "NO_ANSWER"] as const;
    const calls = targets.map((a, i) => {
      const outcome = outcomes[i % outcomes.length];
      const amt = Math.round(a.outstanding * 0.15);
      return {
        id: `BOT-${Math.floor(6000 + Math.random() * 3000)}`,
        accountId: a.id,
        customer: a.customer,
        at: new Date().toISOString(),
        durationSec: outcome === "NO_ANSWER" ? 22 : 45 + Math.floor(Math.random() * 100),
        outcome,
        transcript: [
          { speaker: "BOT" as const, text: `Hello, this is Ava calling from OmniRecover regarding your ${a.product} account. Am I speaking with ${a.customer}?` },
          { speaker: "CUSTOMER" as const, text: outcome === "NO_ANSWER" ? "(no answer — voicemail)" : "Yes, speaking." },
          { speaker: "BOT" as const, text: `Your past-due balance is $${a.outstanding.toLocaleString()}. I can set up an installment plan today.` },
          { speaker: "CUSTOMER" as const, text: outcome === "PTP_CAPTURED" ? `Okay, I can pay $${amt.toLocaleString()} this week.` : outcome === "CALLBACK_REQUESTED" ? "Call me back after the 1st." : "I can't do this right now." },
          { speaker: "BOT" as const, text: outcome === "PTP_CAPTURED" ? `Recorded — $${amt.toLocaleString()} expected this week. Confirmation sent by SMS. Goodbye.` : "Understood. I've noted that. Goodbye." },
        ],
      };
    });
    addBotCalls(calls, auth?.name ?? "Ava · Voice Bot");
    return { ok: true, data: { calls: calls.length, ptps: calls.filter((c) => c.outcome === "PTP_CAPTURED").length } };
  } catch {
    return fail("Voice-bot campaign failed to start.");
  }
}
