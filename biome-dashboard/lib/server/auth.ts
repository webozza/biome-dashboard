import { NextRequest } from "next/server";

export function requireAdmin(req: NextRequest): { ok: true } | { ok: false; reason: string } {
  const expected = (process.env.ADMIN_API_TOKEN || "").trim();
  if (!expected) return { ok: false, reason: "server_not_configured" };

  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim() || req.headers.get("x-admin-token")?.trim() || "";

  if (!token) return { ok: false, reason: "missing_token" };
  if (token !== expected) return { ok: false, reason: "invalid_token" };
  return { ok: true };
}
