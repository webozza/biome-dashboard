import type { NextRequest } from "next/server";
import { json } from "@/lib/server/response";
import { logSecurityView, requireSecuritySuperadmin } from "@/lib/server/security-guard";
import { listSecurityDocs, SECURITY_COLLECTIONS } from "@/lib/server/security-platform-data";
import type { SecurityAuditEvent } from "@/lib/security-audit-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const events = await listSecurityDocs<SecurityAuditEvent>(SECURITY_COLLECTIONS.events, limit);
  await logSecurityView(req, auth.user, "view_platform_data_security_events", events.length);
  return json({ items: events, total: events.length });
}
