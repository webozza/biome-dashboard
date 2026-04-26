import { NextRequest } from "next/server";
import crypto from "crypto";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { buildAuthUrl, getOAuthConfig } from "@/lib/server/email/gmail-oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const cfg = getOAuthConfig();
  if (!cfg) return error("oauth_not_configured", 500, { detail: "Missing GOOGLE_OAUTH_* env" });

  const state = crypto.randomBytes(16).toString("hex");
  const url = buildAuthUrl(state);
  if (!url) return error("auth_url_failed", 500);
  return json({ url, state });
}
