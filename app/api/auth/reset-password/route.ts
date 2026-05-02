import { NextRequest } from "next/server";
import { auth as adminAuth } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { markOtpUsed, verifyOtp } from "@/lib/server/password-reset";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export async function POST(req: NextRequest) {
  let body: { email?: string; otp?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const otp = (body.otp || "").trim();
  const newPassword = body.newPassword || "";

  if (!email || !EMAIL_REGEX.test(email)) return error("invalid_email", 400);
  if (!/^\d{6}$/.test(otp)) return error("invalid_otp_format", 400);
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return error("weak_password", 400, {
      detail: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  const verification = await verifyOtp(email, otp);
  if (!verification.ok) {
    const status =
      verification.reason === "expired" || verification.reason === "used" ? 410 : 400;
    return error(verification.reason, status);
  }

  let uid: string;
  try {
    const user = await adminAuth().getUserByEmail(email);
    uid = user.uid;
  } catch (e) {
    const code = (e as { code?: string })?.code || "";
    if (code === "auth/user-not-found") return error("user_not_found", 404);
    console.error("[reset-password] getUserByEmail failed", { email, code });
    return error("lookup_failed", 500);
  }

  try {
    await adminAuth().updateUser(uid, { password: newPassword });
  } catch (e) {
    const code = (e as { code?: string })?.code || "";
    const message = (e as Error)?.message || "update_failed";
    if (code === "auth/weak-password" || /password/i.test(message)) {
      return error("weak_password", 400, { detail: message });
    }
    console.error("[reset-password] updateUser failed", { email, code, message });
    return error("update_failed", 500);
  }

  await markOtpUsed(email).catch((e) => {
    console.error("[reset-password] markOtpUsed failed", { email, message: (e as Error).message });
  });

  try {
    await adminAuth().revokeRefreshTokens(uid);
  } catch (e) {
    console.error("[reset-password] revokeRefreshTokens failed", { uid, message: (e as Error).message });
  }

  return json({ ok: true, reset: true });
}
