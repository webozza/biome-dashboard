import crypto from "crypto";
import { db } from "./firebase";

const COLLECTION = "passwordResets";
const OTP_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

export type PasswordResetDoc = {
  email: string;
  otpHash: string;
  expiresAt: string;
  attempts: number;
  used: boolean;
  createdAt: string;
  recentRequests: string[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export function generateOtp(): string {
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, "0");
}

export async function recordOtp(email: string, otp: string): Promise<{ ok: true } | { ok: false; reason: "rate_limited" }> {
  const normalized = normalizeEmail(email);
  const ref = db().collection(COLLECTION).doc(normalized);
  const snap = await ref.get();
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = now.getTime() - RATE_LIMIT_WINDOW_MS;

  const previous = snap.exists ? (snap.data() as PasswordResetDoc) : null;
  const recent = (previous?.recentRequests || []).filter((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= cutoff;
  });

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { ok: false, reason: "rate_limited" };
  }

  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await ref.set({
    email: normalized,
    otpHash: hashOtp(otp),
    expiresAt,
    attempts: 0,
    used: false,
    createdAt: nowIso,
    recentRequests: [...recent, nowIso],
  });

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" | "expired" | "used" | "too_many_attempts" | "invalid" };

export async function verifyOtp(email: string, otp: string): Promise<VerifyOtpResult> {
  const normalized = normalizeEmail(email);
  const ref = db().collection(COLLECTION).doc(normalized);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "not_found" };

  const data = snap.data() as PasswordResetDoc;
  if (data.used) return { ok: false, reason: "used" };
  if (data.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (Date.parse(data.expiresAt) < Date.now()) return { ok: false, reason: "expired" };

  if (data.otpHash !== hashOtp(otp)) {
    await ref.update({ attempts: (data.attempts || 0) + 1 });
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, email: normalized };
}

export async function markOtpUsed(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await db().collection(COLLECTION).doc(normalized).update({ used: true, usedAt: new Date().toISOString() });
}

export const PASSWORD_RESET_CONFIG = {
  OTP_TTL_MINUTES,
  MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
};
