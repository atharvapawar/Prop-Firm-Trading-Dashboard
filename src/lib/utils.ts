import type { Settings } from "../types";

// --- Numeric helpers ------------------------------------------------------
export const safeNumber = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const clamp100 = (v: number) => Math.min(Math.max(v, 0), 100);

export const progressPct = (equity: number, start: number, end: number) =>
  equity >= start ? clamp100(((equity - start) / (end - start)) * 100) : 0;

// --- Formatting -----------------------------------------------------------
export function formatCurrency(val: number | string, d = 2) {
  const n = Number(val);
  if (isNaN(n)) return "$0.00";
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function formatSign(val: number | string) {
  const n = Number(val);
  if (isNaN(n)) return "$0.00";
  return `${n >= 0 ? "+" : "-"}${formatCurrency(Math.abs(n))}`;
}

// --- Date helpers ---------------------------------------------------------
export const formatDateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// --- Settings helpers ----------------------------------------------------
/** Determine the "current/start" equity used for risk calculations.
 *  If `masterAccountBalance` is a positive number it overrides the
 *  account balance as the active starting equity. */
export function getStartingBalance(settings: Settings): number {
  const m = Number(settings.masterAccountBalance);
  return Number.isFinite(m) && m > 0 ? m : settings.accountBalance;
}

export default {
  safeNumber,
  clamp100,
  progressPct,
  formatCurrency,
  formatSign,
  formatDateLocal,
  getStartingBalance,
};
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
