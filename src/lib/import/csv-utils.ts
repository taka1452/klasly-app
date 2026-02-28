/**
 * CSVインポート用のバリデーション・正規化
 * members/create と整合を取る
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  return trimmed.length > 0 && EMAIL_REGEX.test(trimmed);
}

export type PlanType = "monthly" | "pack" | "drop_in";
export type MemberStatus = "active" | "paused" | "cancelled";

const PLAN_ALIASES: Record<string, PlanType> = {
  monthly: "monthly",
  pack: "pack",
  "drop_in": "drop_in",
  "drop-in": "drop_in",
  dropin: "drop_in",
  unlimited: "monthly",
  "class pack": "pack",
};
const STATUS_ALIASES: Record<string, MemberStatus> = {
  active: "active",
  paused: "paused",
  cancelled: "cancelled",
  expired: "cancelled",
  suspended: "paused",
};

export function normalizePlanType(value: string | undefined): PlanType {
  if (!value) return "drop_in";
  const key = String(value).trim().toLowerCase();
  return PLAN_ALIASES[key] ?? "drop_in";
}

export function normalizeStatus(value: string | undefined): MemberStatus {
  if (!value) return "active";
  const key = String(value).trim().toLowerCase();
  return STATUS_ALIASES[key] ?? "active";
}

export function parseCredits(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return Math.max(0, Math.floor(value));
  const n = parseInt(String(value).trim(), 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}
