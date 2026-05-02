import { NextRequest } from "next/server";
import { auth as adminAuth } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { generateOtp, recordOtp, PASSWORD_RESET_CONFIG } from "@/lib/server/password-reset";
import { sendPasswordResetOtpEmail } from "@/lib/server/email/transport";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function debugEnabled(req: NextRequest): boolean {
  if (process.env.PASSWORD_RESET_DEBUG === "true") return true;
  const header = req.headers.get("x-debug-token") || "";
  const expected = (process.env.ADMIN_API_TOKEN || "").trim();
  return Boolean(header && expected && header === expected);
}

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return error("invalid_email", 400);
  }

  const debug = debugEnabled(req);

  let userExists = false;
  let lookupError: { code: string; message: string } | null = null;
  try {
    await adminAuth().getUserByEmail(email);
    userExists = true;
  } catch (e) {
    const code = (e as { code?: string })?.code || "unknown";
    const message = (e as Error)?.message || "";
    if (code !== "auth/user-not-found") {
      console.error("[forgot-password] getUserByEmail failed", { email, code, message });
    }
    lookupError = { code, message };
  }

  if (!userExists) {
    if (debug) {
      return json({
        ok: true,
        sent: false,
        debug: {
          reason: lookupError?.code === "auth/user-not-found" ? "user_not_found" : "lookup_failed",
          lookupCode: lookupError?.code,
          lookupMessage: lookupError?.message,
        },
      });
    }
    return json({ ok: true, sent: true });
  }

  const otp = generateOtp();
  const recorded = await recordOtp(email, otp);
  if (!recorded.ok) {
    if (recorded.reason === "rate_limited") {
      return error("rate_limited", 429, {
        detail: `Too many reset requests. Try again in ${Math.ceil(PASSWORD_RESET_CONFIG.RATE_LIMIT_WINDOW_MS / 60000)} minutes.`,
      });
    }
    return error("could_not_create_otp", 500);
  }

  void sendPasswordResetOtpEmail(email, {
    otp,
    expiresInMinutes: PASSWORD_RESET_CONFIG.OTP_TTL_MINUTES,
  });

  if (debug) {
    return json({ ok: true, sent: true, debug: { email, expiresInMinutes: PASSWORD_RESET_CONFIG.OTP_TTL_MINUTES } });
  }
  return json({ ok: true, sent: true });
}
