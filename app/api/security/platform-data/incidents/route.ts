import type { NextRequest } from "next/server";
import { json } from "@/lib/server/response";
import { logSecurityView, requireSecuritySuperadmin } from "@/lib/server/security-guard";
import { listSecurityDocs, SECURITY_COLLECTIONS } from "@/lib/server/security-platform-data";
import type { SecurityIncident } from "@/lib/security-audit-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const incidents = await listSecurityDocs<SecurityIncident>(SECURITY_COLLECTIONS.incidents, 100);
  await logSecurityView(req, auth.user, "view_platform_data_security_incidents", incidents.length);
  return json({ items: incidents, total: incidents.length });
}
