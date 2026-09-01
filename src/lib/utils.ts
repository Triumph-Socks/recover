import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Account, Bucket, ScoreFactors, ScoreWeights } from "./types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* ---------------- formatters ---------------- */

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const num0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const fmtMoney = (n: number): string => usd0.format(n);
export const fmtMoneyCompact = (n: number): string => usdCompact.format(n);
export const fmtNum = (n: number): string => num0.format(n);
export const fmtPct = (n: number, digits = 1): string =>
  `${n.toFixed(digits)}%`;

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(iso);
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export function todayISO(): string {
  return new Date().toISOString();
}

/* ---------------- bucket helpers ---------------- */

export function bucketFromDpd(dpd: number): Bucket {
  if (dpd <= 0) return "CUR";
  if (dpd < 30) return "B1";
  if (dpd < 60) return "B2";
  if (dpd < 90) return "B3";
  if (dpd < 120) return "B4";
  return "B5";
}

export const BUCKET_COLORS: Record<Bucket, string> = {
  CUR: "#10b981",
  B1: "#f59e0b",
  B2: "#f97316",
  B3: "#ef4444",
  B4: "#e11d48",
  B5: "#9f1239",
};

/* ---------------- AI propensity engine ---------------- */

export function computeFactors(
  dpd: number,
  outstanding: number,
  behaviorScore: number,
  lastContact: string | null
): ScoreFactors {
  const dpdF = Math.max(0, 1 - dpd / 150);
  const balanceF = Math.min(1, 0.25 + outstanding / 400000);
  const behaviorF = behaviorScore / 100;
  const recencyF = lastContact
    ? Math.max(0.15, 1 - (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24 * 45))
    : 0.45;
  return {
    dpd: round2(dpdF),
    balance: round2(balanceF),
    behavior: round2(behaviorF),
    recency: round2(recencyF),
  };
}

export function scoreFromFactors(f: ScoreFactors, w: ScoreWeights): number {
  const total = w.dpd + w.balance + w.behavior + w.recency || 1;
  const raw =
    (f.dpd * w.dpd + f.balance * w.balance + f.behavior * w.behavior + f.recency * w.recency) /
    total;
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

export function scoreAccount(a: Account, w: ScoreWeights): Account {
  const factors = computeFactors(a.dpd, a.outstanding, a.behaviorScore, a.lastContact);
  return { ...a, factors, score: scoreFromFactors(factors, w) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------------- misc ---------------- */

let uidCounter = 0;
export function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}-${Math.floor(Math.random() * 1e4)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function downloadCSV(filename: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
