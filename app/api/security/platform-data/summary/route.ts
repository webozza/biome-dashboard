import type { NextRequest } from "next/server";
import { db } from "@/lib/server/firebase";
import { json } from "@/lib/server/response";
import { logSecurityView, requireSecuritySuperadmin } from "@/lib/server/security-guard";
import { listSecurityDocs, SECURITY_COLLECTIONS } from "@/lib/server/security-platform-data";
import type { SecurityAuditEvent, SecurityIncident, SecurityReview } from "@/lib/security-audit-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [events, incidents, reviews] = await Promise.all([
    listSecurityDocs<SecurityAuditEvent>(SECURITY_COLLECTIONS.events, 200),
    listSecurityDocs<SecurityIncident>(SECURITY_COLLECTIONS.incidents, 100),
    listSecurityDocs<SecurityReview>(SECURITY_COLLECTIONS.reviews, 20),
  ]);
  const recentEvents = events.filter((event) => event.occurredAt >= sevenDaysAgo);
  const openIncidents = incidents.filter((incident) =>
    ["open", "investigating", "confirmed_incident", "escalated"].includes(String(incident.status))
  );
  const criticalHighEvents = recentEvents.filter((event) => event.severity === "CRITICAL" || event.severity === "ERROR");
  const platformReads = recentEvents.filter((event) => event.eventType === "META_GRAPH_READ");
  const failedDenied = recentEvents.filter((event) => event.outcome === "failure" || event.outcome === "denied");
  const lastReview = reviews.find((review) => review.status === "completed") || null;
  const nextReview = reviews.find((review) => review.status !== "completed") || null;
  const heartbeatSnap = await db().collection(SECURITY_COLLECTIONS.events).select().limit(1).get();

  await logSecurityView(req, auth.user, "view_platform_data_security_summary", recentEvents.length);
  return json({
    lastCompletedReview: lastReview,
    nextReviewDeadline: nextReview?.dueAt || lastReview?.nextDueAt || null,
    openIncidents: openIncidents.length,
    criticalHighEventsLast7Days: criticalHighEvents.length,
    platformDataReadsLast7Days: platformReads.reduce((sum, event) => sum + (event.recordCount || 1), 0),
    failedDeniedAccessLast7Days: failedDenied.length,
    backendLoggingHealth: {
      firebaseFunctions: events.some((event) => event.backendSource === "firebase-functions"),
      dashboardVps: events.some((event) => event.backendSource === "dashboard-vps"),
      hasSecurityEvents: !heartbeatSnap.empty,
    },
    totals: {
      events: events.length,
      incidents: incidents.length,
      reviews: reviews.length,
    },
  });
}
