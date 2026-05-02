import { NextRequest } from "next/server";
import { error, json } from "@/lib/server/response";
import { verifyOtp } from "@/lib/server/password-reset";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; otp?: string };
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const otp = (body.otp || "").trim();

  if (!email || !EMAIL_REGEX.test(email)) return error("invalid_email", 400);
  if (!/^\d{6}$/.test(otp)) return error("invalid_otp_format", 400);

  const result = await verifyOtp(email, otp);
  if (!result.ok) {
    const status =
      result.reason === "expired" || result.reason === "used" ? 410 : 400;
    return error(result.reason, status);
  }

  return json({ ok: true, valid: true });
}
