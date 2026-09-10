import type {
  Account,
  AccountStatus,
  Activity,
  Agency,
  BotCall,
  BotOutcome,
  Bucket,
  CallLog,
  Lane,
  LegalCase,
  Payment,
  PaymentChannel,
  ProductType,
  ScoreWeights,
  User,
  WriteOff,
} from "../lib/types";
import { bucketFromDpd, computeFactors, scoreFromFactors } from "../lib/utils";

/* Deterministic PRNG so the demo dataset is stable */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260214);
const int = (min: number, max: number): number => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number): boolean => rnd() < p;

const FIRST = ["Omar", "Layla", "James", "Fatima", "Chen", "Maria", "Ahmed", "Sarah", "Raj", "Elena", "Yusuf", "Nadia", "Tom", "Aisha", "Diego", "Hana", "Peter", "Zara", "Khalid", "Ines", "Marcus", "Priya", "John", "Amira", "Viktor", "Lucia", "Sam", "Rania", "David", "Mei"];
const LAST = ["Haddad", "Mercer", "Okafor", "Al-Rashid", "Wei", "Santos", "Farouk", "Mitchell", "Sharma", "Petrova", "Karim", "Hassan", "Bennett", "Rahman", "Torres", "Kim", "Novak", "Malik", "Abbasi", "Moreau", "Webb", "Nair", "Carter", "Farsi", "Lund", "Vega", "Feld", "Idris", "Osei", "Lin"];
const CITIES = ["New York", "Chicago", "Houston", "Dubai", "London", "Kuala Lumpur", "Riyadh", "Toronto", "Singapore", "Miami", "Dallas", "Abu Dhabi", "Doha", "Manama", "Los Angeles", "Atlanta"];
const COUNSEL = ["Hassan & Associates", "Mercer Legal LLP", "Al Tamimi Counsel", "Grant & Pierce", "Rahman Law Chambers"];
const STREETS = ["Maple Ave", "Harbor St", "King Rd", "Sunset Blvd", "Park Lane", "Market St", "Lake View Dr", "Union Sq"];

export const DEFAULT_WEIGHTS: ScoreWeights = { dpd: 30, balance: 20, behavior: 35, recency: 15 };
export const DEFAULT_BANDS = { top: 72, standard: 48 };

const PRODUCTS: { type: ProductType; prefix: string; segment: Account["segment"]; min: number; max: number }[] = [
  { type: "Personal Loan", prefix: "LN", segment: "Retail", min: 4000, max: 60000 },
  { type: "Credit Card", prefix: "CC", segment: "Retail", min: 800, max: 18000 },
  { type: "Auto Finance", prefix: "AU", segment: "Retail", min: 8000, max: 55000 },
  { type: "Shariah Finance", prefix: "SH", segment: "Retail", min: 10000, max: 120000 },
  { type: "Corporate Loan", prefix: "CR", segment: "Corporate", min: 250000, max: 2400000 },
  { type: "Commercial RE", prefix: "CM", segment: "Corporate", min: 400000, max: 3200000 },
  { type: "Trade Finance", prefix: "TF", segment: "SME", min: 60000, max: 750000 },
];

const DPD_BANDS: { bucket: Bucket; min: number; max: number; weight: number }[] = [
  { bucket: "CUR", min: 0, max: 0, weight: 10 },
  { bucket: "B1", min: 1, max: 29, weight: 24 },
  { bucket: "B2", min: 30, max: 59, weight: 22 },
  { bucket: "B3", min: 60, max: 89, weight: 17 },
  { bucket: "B4", min: 90, max: 119, weight: 14 },
  { bucket: "B5", min: 120, max: 320, weight: 13 },
];

function weightedBucket(): { bucket: Bucket; min: number; max: number } {
  const total = DPD_BANDS.reduce((s, b) => s + b.weight, 0);
  let r = rnd() * total;
  for (const b of DPD_BANDS) {
    r -= b.weight;
    if (r <= 0) return b;
  }
  return DPD_BANDS[1];
}

/* ---------------- users ---------------- */

export function seedUsers(): User[] {
  return [
    { id: "u-admin", name: "Ayesha Khan", email: "admin@omni.com", password: "admin123", role: "SUPER_ADMIN", title: "Platform Administrator", active: true },
    { id: "u-manager", name: "Daniel Mercer", email: "manager@omni.com", password: "manager123", role: "MANAGER", title: "Collections Manager", active: true },
    { id: "u-agent", name: "Sofia Reyes", email: "agent@omni.com", password: "agent123", role: "AGENT", title: "Senior Collection Agent", active: true },
    { id: "u-agency", name: "Marcus Webb", email: "agency@omni.com", password: "agency123", role: "AGENCY", title: "Apex Recoveries LLC", active: true },
    { id: "u-legal", name: "Priya Nair", email: "legal@omni.com", password: "legal123", role: "LEGAL", title: "Legal Recovery Counsel", active: true },
    { id: "u-a2", name: "Jamal Okafor", email: "jamal@omni.com", password: "agent123", role: "AGENT", title: "Collection Agent", active: true },
    { id: "u-a3", name: "Elena Petrova", email: "elena@omni.com", password: "agent123", role: "AGENT", title: "Collection Agent", active: true },
    { id: "u-a4", name: "Raj Sharma", email: "raj@omni.com", password: "agent123", role: "AGENT", title: "Collection Agent", active: true },
    { id: "u-a5", name: "Hana Kim", email: "hana@omni.com", password: "agent123", role: "AGENT", title: "Collection Agent", active: true },
    { id: "u-a6", name: "Diego Torres", email: "diego@omni.com", password: "agent123", role: "AGENT", title: "Collection Agent", active: true },
  ];
}

export function seedAgencies(): Agency[] {
  return [
    { id: "ag-1", name: "Apex Recoveries LLC", contact: "marcus@apexrec.com", commissionPct: 22, assignedCount: 0, recovered: 486200, placed: 2140000, status: "ACTIVE" },
    { id: "ag-2", name: "NorthBridge Collections", contact: "ops@northbridge.co", commissionPct: 18, assignedCount: 0, recovered: 311750, placed: 1620000, status: "ACTIVE" },
    { id: "ag-3", name: "Falcon Debt Partners", contact: "desk@falcondp.com", commissionPct: 25, assignedCount: 0, recovered: 154300, placed: 980000, status: "ACTIVE" },
    { id: "ag-4", name: "Meridian Recovery Group", contact: "team@meridianrg.io", commissionPct: 20, assignedCount: 0, recovered: 92400, placed: 720000, status: "ON_HOLD" },
  ];
}

/* ---------------- accounts ---------------- */

interface CustomerBase {
  cif: string;
  name: string;
  city: string;
  phone: string;
  email: string;
}

function makeCustomers(n: number): CustomerBase[] {
  const out: CustomerBase[] = [];
  for (let i = 0; i < n; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    out.push({
      cif: `CIF-${int(10000, 98999)}`,
      name,
      city: pick(CITIES),
      phone: `+1 (${int(201, 989)}) ${int(200, 989)}-${String(int(0, 9999)).padStart(4, "0")}`,
      email: `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(/ +/g, ".")}@mail.com`,
    });
  }
  return out;
}

export function seedAccounts(users: User[]): Account[] {
  const agents = users.filter((u) => u.role === "AGENT");
  const customers = makeCustomers(185);
  const accounts: Account[] = [];
  const now = Date.now();

  const customerAccounts = new Map<string, number>();

  for (let i = 0; i < 260; i++) {
    const cust = pick(customers);
    const count = customerAccounts.get(cust.cif) ?? 0;
    customerAccounts.set(cust.cif, count + 1);
    if (count >= 3) continue;

    const prod = count > 0 && chance(0.7) ? pick(PRODUCTS.slice(0, 4)) : pick(PRODUCTS);
    const band = weightedBucket();
    const dpd = band.min === band.max ? 0 : int(band.min, band.max);
    const principal = int(prod.min / 500, prod.max / 500) * 500;
    const paidOff = band.bucket === "CUR" && chance(0.08);
    const outstanding = paidOff ? 0 : Math.max(500, Math.round(principal * (0.35 + rnd() * 0.6)));
    const behaviorScore = Math.max(8, Math.min(97, int(30, 95) - Math.round(dpd / 6) + int(-8, 8)));
    const lastContact = chance(0.82)
      ? new Date(now - int(1, 45) * 86400000 - int(0, 86000) * 1000).toISOString()
      : null;
    const openedAt = new Date(now - int(120, 1400) * 86400000).toISOString();

    let status: AccountStatus = dpd === 0 ? (paidOff ? "PAID" : "NEW") : "IN_COLLECTIONS";
    if (dpd >= 60 && chance(0.1)) status = "AGENCY";
    if (dpd >= 90 && chance(0.08)) status = "LEGAL";
    if (dpd > 0 && chance(0.09)) status = "PTP";
    if (dpd > 0 && chance(0.06)) status = "BROKEN_PTP";

    const factors = computeFactors(dpd, outstanding, behaviorScore, lastContact);
    const score = scoreFromFactors(factors, DEFAULT_WEIGHTS);

    const account: Account = {
      id: `${prod.prefix}-24-${String(1000 + i)}`,
      cif: cust.cif,
      customer: cust.name,
      segment: prod.segment,
      product: prod.type,
      outstanding,
      principal,
      dpd,
      bucket: bucketFromDpd(dpd),
      score,
      factors,
      behaviorScore,
      status,
      lane: null,
      ownerId: null,
      agencyId: status === "AGENCY" ? pick(["ag-1", "ag-2", "ag-3"]) : null,
      legalCaseId: null,
      phone: cust.phone,
      email: cust.email,
      city: cust.city,
      lastContact,
      openedAt,
      ptp: status === "PTP" ? { date: new Date(now + int(-3, 10) * 86400000).toISOString(), amount: Math.round(outstanding * (0.1 + rnd() * 0.3)), kept: null } : status === "BROKEN_PTP" ? { date: new Date(now - int(2, 20) * 86400000).toISOString(), amount: Math.round(outstanding * 0.15), kept: false } : chance(0.12) ? { date: new Date(now - int(5, 40) * 86400000).toISOString(), amount: Math.round(outstanding * 0.2), kept: true } : null,
      attempts: dpd > 0 ? int(0, 14) : 0,
    };
    accounts.push(account);
  }

  /* Pre-run the allocation engine so lanes are populated on first login */
  let ai = 0;
  for (const a of accounts) {
    if (!["NEW", "IN_COLLECTIONS", "PTP", "BROKEN_PTP"].includes(a.status)) continue;
    if (a.dpd >= 120 && a.outstanding >= 40000) {
      a.lane = "LEGAL";
    } else if (a.score >= DEFAULT_BANDS.top) {
      a.lane = "TOP_AGENT";
      a.ownerId = agents[ai % agents.length].id;
      ai++;
    } else if (a.score >= DEFAULT_BANDS.standard) {
      a.lane = "STANDARD";
      a.ownerId = agents[ai % agents.length].id;
      ai++;
    } else {
      a.lane = "VOICE_BOT";
    }
  }
  return accounts;
}

/* ---------------- payments ---------------- */

export function seedPayments(accounts: Account[], users: User[]): Payment[] {
  const agents = users.filter((u) => u.role === "AGENT");
  const heavy = [agents[0], agents[2], agents[1], agents[0], agents[3], agents[2]];
  const delinquent = accounts.filter((a) => a.outstanding > 0 && a.dpd > 0);
  const methods = ["ACH Transfer", "Card on File", "Wire", "Cash @ Branch", "Direct Debit"];
  const channels: PaymentChannel[] = ["DIALER", "DIALER", "PORTAL", "VOICE_BOT", "AGENCY", "BRANCH"];
  const now = Date.now();
  const out: Payment[] = [];

  for (let day = 89; day >= 0; day--) {
    const n = int(5, 13);
    for (let k = 0; k < n; k++) {
      const acc = pick(delinquent);
      const agent = chance(0.75) ? pick(heavy) : pick(agents);
      const amount = Math.max(150, Math.round((acc.outstanding * (0.04 + rnd() * 0.3)) / 10) * 10);
      const d = new Date(now - day * 86400000 - int(2, 10) * 3600000);
      out.push({
        id: `PAY-${90000 + out.length}`,
        accountId: acc.id,
        cif: acc.cif,
        customer: acc.customer,
        product: acc.product,
        amount,
        date: d.toISOString(),
        method: pick(methods),
        channel: pick(channels),
        agentId: agent.id,
        agentName: agent.name,
      });
    }
  }
  return out;
}

/* ---------------- legal, write-offs, bot calls, activity ---------------- */

export function seedLegalCases(accounts: Account[]): LegalCase[] {
  const candidates = accounts
    .filter((a) => a.dpd >= 90 && a.outstanding >= 25000)
    .slice(0, 11);
  const now = Date.now();
  return candidates.map((a, i) => {
    const stage = i % 5;
    const filed = new Date(now - int(20, 160) * 86400000).toISOString();
    a.status = "LEGAL";
    a.lane = null;
    const id = `LC-2024-${String(300 + i)}`;
    a.legalCaseId = id;
    return {
      id,
      accountId: a.id,
      customer: a.customer,
      product: a.product,
      amount: a.outstanding,
      stage,
      filedOn: filed,
      nextDate: new Date(now + int(3, 40) * 86400000).toISOString(),
      counsel: pick(COUNSEL),
      history: [
        { at: filed, actor: "Priya Nair", note: `Case opened — ${a.product} recovery, demand notice issued to ${a.customer}.` },
        ...(stage >= 1 ? [{ at: new Date(now - int(10, 18) * 86400000).toISOString(), actor: "Priya Nair", note: "Suit filed with civil court; summons served." }] : []),
        ...(stage >= 2 ? [{ at: new Date(now - int(2, 9) * 86400000).toISOString(), actor: "Priya Nair", note: "First hearing attended; defendant requested extension." }] : []),
      ],
    };
  });
}

export function seedWriteOffs(accounts: Account[], users: User[]): WriteOff[] {
  const candidates = accounts.filter((a) => a.dpd >= 150 && a.outstanding > 0 && a.outstanding < 90000).slice(0, 6);
  const stages: WriteOff["stage"][] = ["RECOMMENDED", "MANAGER_REVIEW", "FINAL_APPROVAL", "WRITTEN_OFF", "REJECTED", "MANAGER_REVIEW"];
  const now = Date.now();
  return candidates.map((a, i) => {
    const stage = stages[i % stages.length];
    if (stage === "WRITTEN_OFF") a.status = "WRITTEN_OFF";
    const base = { accountId: a.id, customer: a.customer, product: a.product, amount: a.outstanding };
    const history: WriteOff["history"] = [
      { at: new Date(now - int(12, 30) * 86400000).toISOString(), actor: "Sofia Reyes", role: "AGENT" as const, action: "Recommended write-off", comment: "Exhausted dialer attempts; debtor unemployed, no assets located." },
    ];
    if (["FINAL_APPROVAL", "WRITTEN_OFF", "REJECTED"].includes(stage))
      history.push({ at: new Date(now - int(4, 10) * 86400000).toISOString(), actor: "Daniel Mercer", role: "MANAGER" as const, action: "Manager approved", comment: "Verified collection history; concur with recommendation." });
    if (stage === "WRITTEN_OFF")
      history.push({ at: new Date(now - int(1, 3) * 86400000).toISOString(), actor: "Ayesha Khan", role: "SUPER_ADMIN" as const, action: "Final approval — written off", comment: "Approved per policy WO-7.2; GL adjustment posted." });
    if (stage === "REJECTED")
      history.push({ at: new Date(now - int(1, 3) * 86400000).toISOString(), actor: "Daniel Mercer", role: "MANAGER" as const, action: "Rejected", comment: "Guarantor identified — pursue recovery before write-off." });
    return { id: `WO-24-${String(140 + i)}`, reason: pick(["Debtor insolvent — no attachable assets", "Statute of limitations approaching, cost of suit exceeds balance", "Deceased — estate closed, no proceeds", "Bankruptcy discharged (Ch. 7)", "Untraceable skip — 18 months no contact"]), stage, history, ...base };
  });
}

export function seedBotCalls(accounts: Account[]): BotCall[] {
  const targets = accounts.filter((a) => a.lane === "VOICE_BOT" && a.outstanding > 0).slice(0, 12);
  const now = Date.now();
  const outcomes: BotOutcome[] = ["PTP_CAPTURED", "PTP_CAPTURED", "CALLBACK_REQUESTED", "REFUSED", "NO_ANSWER", "PTP_CAPTURED", "CALLBACK_REQUESTED", "NO_ANSWER", "REFUSED", "PTP_CAPTURED", "CALLBACK_REQUESTED", "NO_ANSWER"];

  return targets.map((a, i) => {
    const outcome = outcomes[i % outcomes.length];
    const amt = Math.round(a.outstanding * 0.15);
    const transcript =
      outcome === "NO_ANSWER"
        ? [{ speaker: "BOT" as const, text: `Outbound attempt to ${a.phone}. No answer after 4 rings. Voicemail box full — retry scheduled for tomorrow 10:00.` }]
        : [
            { speaker: "BOT" as const, text: `Hello, this is Ava calling from OmniRecover on behalf of your ${a.product} account. Am I speaking with ${a.customer}?` },
            { speaker: "CUSTOMER" as const, text: outcome === "REFUSED" ? "I already told you people, I can't pay right now." : "Yes, this is me." },
            { speaker: "BOT" as const, text: `Thank you. Your account ending ${a.id.slice(-4)} shows a past-due balance of $${a.outstanding.toLocaleString()}, ${a.dpd} days delinquent. We can split this into 3 interest-free installments.` },
            ...(outcome === "PTP_CAPTURED"
              ? [
                  { speaker: "CUSTOMER" as const, text: `Fine. I can pay $${amt.toLocaleString()} on Friday.` },
                  { speaker: "BOT" as const, text: `I've recorded a promise to pay of $${amt.toLocaleString()} for Friday. A confirmation SMS is on its way. Thank you — goodbye.` },
                ]
              : outcome === "CALLBACK_REQUESTED"
                ? [
                    { speaker: "CUSTOMER" as const, text: "I get paid next week. Call me back on Monday." },
                    { speaker: "BOT" as const, text: "Of course. I've scheduled a callback for Monday at 11:00 AM. Have a good day." },
                  ]
                : [
                    { speaker: "CUSTOMER" as const, text: "Not interested. Stop calling." },
                    { speaker: "BOT" as const, text: "I understand. I'll note your response and a specialist will follow up in writing. Goodbye." },
                  ]),
          ];
    return {
      id: `BOT-${5200 + i}`,
      accountId: a.id,
      customer: a.customer,
      at: new Date(now - int(0, 5) * 86400000 - int(1, 9) * 3600000).toISOString(),
      durationSec: outcome === "NO_ANSWER" ? int(18, 26) : int(42, 150),
      outcome,
      transcript,
    };
  });
}

export function seedCallLogs(accounts: Account[], users: User[]): CallLog[] {
  const agents = users.filter((u) => u.role === "AGENT");
  const owned = accounts.filter((a) => a.ownerId !== null).slice(0, 18);
  const now = Date.now();
  const outcomes: CallLog["outcome"][] = ["CONNECTED_PTP", "CONNECTED_NO_PTP", "NO_ANSWER", "VOICEMAIL", "CONNECTED_PTP", "WRONG_NUMBER", "CONNECTED_NO_PTP", "NO_ANSWER"];
  return owned.map((a, i) => ({
    id: `CALL-${8100 + i}`,
    accountId: a.id,
    customer: a.customer,
    agentId: a.ownerId ?? agents[0].id,
    agentName: (agents.find((u) => u.id === a.ownerId) ?? agents[0]).name,
    at: new Date(now - int(0, 6) * 86400000 - int(1, 8) * 3600000).toISOString(),
    durationSec: int(25, 420),
    outcome: outcomes[i % outcomes.length],
    notes: pick(["Debtor cooperative, reviewing options.", "Requested statement by email.", "Disputed interest portion — escalate.", "Asked for callback after payday.", "Spoke with spouse, message taken."]),
  }));
}

export function seedActivity(payments: Payment[]): Activity[] {
  const now = Date.now();
  const fromPayments: Activity[] = payments.slice(-14).reverse().map((p, i) => ({
    id: `ACT-P${i}`,
    at: p.date,
    type: "PAYMENT",
    message: `${p.customer} paid $${p.amount.toLocaleString()} on ${p.product} (${p.method})`,
    actor: p.agentName ?? "System",
  }));
  const system: Activity[] = [
    { id: "ACT-S1", at: new Date(now - 3600e3 * 2).toISOString(), type: "ALERT", message: "Roll-rate B3→B4 exceeded 15% threshold this week", actor: "Risk Engine" },
    { id: "ACT-S2", at: new Date(now - 3600e3 * 5).toISOString(), type: "BOT", message: "AI Voice Bot completed 42 outbound attempts — 11 PTPs captured", actor: "Ava · Voice Bot" },
    { id: "ACT-S3", at: new Date(now - 3600e3 * 9).toISOString(), type: "ASSIGN", message: "Allocation engine assigned 128 accounts across 4 lanes", actor: "AI Engine" },
    { id: "ACT-S4", at: new Date(now - 3600e3 * 26).toISOString(), type: "LEGAL", message: "Judgment obtained in LC-2024-304 — execution proceedings initiated", actor: "Priya Nair" },
    { id: "ACT-S5", at: new Date(now - 3600e3 * 31).toISOString(), type: "PTP", message: "6 promises-to-pay due today across Retail portfolio", actor: "System" },
    { id: "ACT-S6", at: new Date(now - 3600e3 * 49).toISOString(), type: "WRITEOFF", message: "WO-24-143 received final approval — $18.4K written off", actor: "Ayesha Khan" },
  ];
  return [...system, ...fromPayments].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

export interface SeedDB {
  users: User[];
  accounts: Account[];
  payments: Payment[];
  agencies: Agency[];
  legalCases: LegalCase[];
  writeOffs: WriteOff[];
  botCalls: BotCall[];
  callLogs: CallLog[];
  activity: Activity[];
  weights: ScoreWeights;
  bands: { top: number; standard: number };
}

export function generateSeed(): SeedDB {
  const users = seedUsers();
  const accounts = seedAccounts(users);
  const payments = seedPayments(accounts, users);
  const legalCases = seedLegalCases(accounts);
  const writeOffs = seedWriteOffs(accounts, users);
  const botCalls = seedBotCalls(accounts);
  const callLogs = seedCallLogs(accounts, users);
  const agencies = seedAgencies();
  for (const a of accounts) {
    if (a.agencyId) {
      const ag = agencies.find((x) => x.id === a.agencyId);
      if (ag) ag.assignedCount += 1;
    }
  }
  return {
    users,
    accounts,
    payments,
    agencies,
    legalCases,
    writeOffs,
    botCalls,
    callLogs,
    activity: seedActivity(payments),
    weights: { ...DEFAULT_WEIGHTS },
    bands: { ...DEFAULT_BANDS },
  };
}
