import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveConnection, getOAuthConfig } from "@/lib/server/email/gmail-oauth";

export const dynamic = "force-dynamic";

function redirectTo(url: string, status: "connected" | "error", detail?: string) {
  const target = new URL("/dashboard/settings", url);
  target.searchParams.set("gmail", status);
  if (detail) target.searchParams.set("detail", detail);
  return NextResponse.redirect(target);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const code = url.searchParams.get("code");
  const errParam = url.searchParams.get("error");

  if (errParam) return redirectTo(base, "error", errParam);
  if (!code) return redirectTo(base, "error", "missing_code");

  const cfg = getOAuthConfig();
  if (!cfg) return redirectTo(base, "error", "oauth_not_configured");

  try {
    const conn = await exchangeCode(code);
    if (!conn) return redirectTo(base, "error", "exchange_failed");
    await saveConnection(conn, null);
    return redirectTo(base, "connected");
  } catch (e) {
    return redirectTo(base, "error", encodeURIComponent((e as Error).message).slice(0, 200));
  }
}
