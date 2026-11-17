import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NNBSP = "\u202f";

/** 25000 → « 25 000 » (séparateur fin insécable, ou celui fourni). */
export function formatNumber(n: number, sep = NNBSP) {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatFcfa(n: number, sep = NNBSP) {
  return `${formatNumber(n, sep)}${sep === NNBSP ? "\u00a0" : " "}F`;
}

export function formatPercent(ratio: number | null, digits = 2) {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}\u00a0%`;
}

export function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}\u00a0M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}\u00a0k`;
  return formatNumber(n);
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Porto-Novo" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const pureDateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));
/** Pour les colonnes DATE (sans heure), stockées à minuit UTC. */
export const formatDay = (d: Date | string) => dayFmt.format(new Date(d));
export const formatPureDate = (d: Date | string) => pureDateFmt.format(new Date(d));

export function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || toIsoDate(d) !== s ? null : d;
}

export function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function todayUtc() {
  return parseIsoDate(toIsoDate(new Date()))!;
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans 0/O/1/I

export function randomCode(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function makeReference(prefix: string) {
  const now = new Date();
  const ym = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${ym}-${randomCode(6)}`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function truncate(s: string, max: number) {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export function safeDivide(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
