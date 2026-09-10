/* ============================================================
   OmniRecover OS — Domain Types (strict, no `any`)
   ============================================================ */

export type Role =
  | "SUPER_ADMIN"
  | "MANAGER"
  | "AGENT"
  | "AGENCY"
  | "LEGAL";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  title: string;
  active: boolean;
}

export type ProductType =
  | "Personal Loan"
  | "Credit Card"
  | "Auto Finance"
  | "Shariah Finance"
  | "Corporate Loan"
  | "Commercial RE"
  | "Trade Finance";

export type Bucket = "CUR" | "B1" | "B2" | "B3" | "B4" | "B5";

export const BUCKETS: { code: Bucket; label: string; range: string }[] = [
  { code: "CUR", label: "Current", range: "0 DPD" },
  { code: "B1", label: "Bucket 1", range: "1–29 DPD" },
  { code: "B2", label: "Bucket 2", range: "30–59 DPD" },
  { code: "B3", label: "Bucket 3", range: "60–89 DPD" },
  { code: "B4", label: "Bucket 4", range: "90–119 DPD" },
  { code: "B5", label: "Bucket 5", range: "120+ DPD" },
];

export type AccountStatus =
  | "NEW"
  | "IN_COLLECTIONS"
  | "PTP"
  | "BROKEN_PTP"
  | "AGENCY"
  | "LEGAL"
  | "WRITTEN_OFF"
  | "PAID";

export type Lane = "TOP_AGENT" | "STANDARD" | "VOICE_BOT" | "LEGAL";

export type Segment = "Retail" | "SME" | "Corporate";

export interface ScoreFactors {
  dpd: number;
  balance: number;
  behavior: number;
  recency: number;
}

export interface PTP {
  date: string; // ISO
  amount: number;
  kept: boolean | null;
}

export interface Account {
  id: string;
  cif: string;
  customer: string;
  segment: Segment;
  product: ProductType;
  outstanding: number;
  principal: number;
  dpd: number;
  bucket: Bucket;
  score: number;
  factors: ScoreFactors;
  behaviorScore: number;
  status: AccountStatus;
  lane: Lane | null;
  ownerId: string | null;
  agencyId: string | null;
  legalCaseId: string | null;
  phone: string;
  email: string;
  city: string;
  lastContact: string | null;
  openedAt: string;
  ptp: PTP | null;
  attempts: number;
}

export type PaymentChannel =
  | "DIALER"
  | "VOICE_BOT"
  | "AGENCY"
  | "PORTAL"
  | "BRANCH";

export interface Payment {
  id: string;
  accountId: string;
  cif: string;
  customer: string;
  product: ProductType;
  amount: number;
  date: string;
  method: string;
  channel: PaymentChannel;
  agentId: string | null;
  agentName: string | null;
}

export type ActivityType =
  | "PAYMENT"
  | "PTP"
  | "CALL"
  | "BOT"
  | "ALERT"
  | "ASSIGN"
  | "LEGAL"
  | "WRITEOFF"
  | "SYSTEM";

export interface Activity {
  id: string;
  at: string;
  type: ActivityType;
  message: string;
  actor: string;
}

export interface Agency {
  id: string;
  name: string;
  contact: string;
  commissionPct: number;
  assignedCount: number;
  recovered: number;
  placed: number;
  status: "ACTIVE" | "ON_HOLD";
}

export const LEGAL_STAGES = [
  "Demand Notice",
  "Suit Filed",
  "Court Hearing",
  "Judgment",
  "Execution",
] as const;

export interface LegalCase {
  id: string;
  accountId: string;
  customer: string;
  product: ProductType;
  amount: number;
  stage: number; // index into LEGAL_STAGES
  filedOn: string;
  nextDate: string;
  counsel: string;
  history: { at: string; actor: string; note: string }[];
}

export type WriteOffStage =
  | "RECOMMENDED"
  | "MANAGER_REVIEW"
  | "FINAL_APPROVAL"
  | "WRITTEN_OFF"
  | "REJECTED";

export interface WriteOff {
  id: string;
  accountId: string;
  customer: string;
  product: ProductType;
  amount: number;
  reason: string;
  stage: WriteOffStage;
  history: { at: string; actor: string; role: Role; action: string; comment: string }[];
}

export interface BotTurn {
  speaker: "BOT" | "CUSTOMER";
  text: string;
}

export interface BotCall {
  id: string;
  accountId: string;
  customer: string;
  at: string;
  durationSec: number;
  outcome: BotOutcome;
  transcript: BotTurn[];
}

export type BotOutcome = "PTP_CAPTURED" | "CALLBACK_REQUESTED" | "REFUSED" | "NO_ANSWER";

export type CallOutcome =
  | "CONNECTED_PTP"
  | "CONNECTED_NO_PTP"
  | "NO_ANSWER"
  | "VOICEMAIL"
  | "WRONG_NUMBER";

export interface CallLog {
  id: string;
  accountId: string;
  customer: string;
  agentId: string;
  agentName: string;
  at: string;
  durationSec: number;
  outcome: CallOutcome;
  notes: string;
}

export interface ScoreWeights {
  dpd: number;
  balance: number;
  behavior: number;
  recency: number;
}

export interface AllocationBands {
  top: number;
  standard: number;
}

export interface AllocationSummary {
  scored: number;
  topAgent: number;
  standard: number;
  voiceBot: number;
  legal: number;
  valueAllocated: number;
  durationMs: number;
}

export interface ActionResult<T> {
  ok: true;
  data: T;
}
export interface ActionError {
  ok: false;
  error: string;
}
export type ActionReturn<T> = ActionResult<T> | ActionError;
