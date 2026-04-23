import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { clearConnection, getOAuthConfig, loadConnection } from "@/lib/server/email/gmail-oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const cfg = getOAuthConfig();
  if (!cfg) {
    return json({
      configured: false,
      connected: false,
      email: null,
      reason: "Set GOOGLE_OAUTH_CLIENT_ID / SECRET / REDIRECT_URI in the environment",
    });
  }

  try {
    const conn = await loadConnection();
    return json({
      configured: true,
      connected: Boolean(conn),
      email: conn?.email || null,
      connectedAt: conn?.connectedAt || null,
      connectedBy: conn?.connectedBy || null,
    });
  } catch (e) {
    return error("gmail_status_failed", 500, { detail: String((e as Error).message) });
  }
}

export async function DELETE(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  try {
    await clearConnection();
    return json({ ok: true });
  } catch (e) {
    return error("gmail_disconnect_failed", 500, { detail: String((e as Error).message) });
  }
}
