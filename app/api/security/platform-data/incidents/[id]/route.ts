import type { NextRequest } from "next/server";
import { admin, db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { requireSecuritySuperadmin } from "@/lib/server/security-guard";
import { auditInputForAdminAction, writeSecurityAuditEvent } from "@/lib/server/security-audit";
import { appendSecurityActivity, SECURITY_COLLECTIONS } from "@/lib/server/security-platform-data";
import type { SecurityIncidentStatus } from "@/lib/security-audit-types";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<SecurityIncidentStatus>([
  "open",
  "investigating",
  "benign",
  "test_event",
  "confirmed_incident",
  "escalated",
  "resolved",
]);

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as {
    status?: unknown;
    reviewNotes?: unknown;
    cloudIncidentId?: unknown;
    cloudIncidentUrl?: unknown;
  } | null;
  const status = String(body?.status || "").trim() as SecurityIncidentStatus;
  const reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes.trim() : "";

  if (!ALLOWED_STATUSES.has(status)) return error("invalid_incident_status", 400);
  if (!reviewNotes) return error("review_notes_required", 400);

  const patch: Record<string, unknown> = {
    status,
    reviewState: status,
    reviewNotes,
    assignedReviewerUid: auth.user.uid,
    assignedReviewerEmail: auth.user.email,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (status === "resolved" || status === "test_event" || status === "benign") {
    patch.resolvedAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (typeof body?.cloudIncidentId === "string") patch.cloudIncidentId = body.cloudIncidentId.trim() || null;
  if (typeof body?.cloudIncidentUrl === "string") patch.cloudIncidentUrl = body.cloudIncidentUrl.trim() || null;

  await db().collection(SECURITY_COLLECTIONS.incidents).doc(id).set(patch, { merge: true });
  await appendSecurityActivity({
    type: "incident_review_update",
    targetType: "incident",
    targetId: id,
    actorUid: auth.user.uid,
    actorEmail: auth.user.email,
    note: `${status}: ${reviewNotes}`,
  });
  await writeSecurityAuditEvent(
    auditInputForAdminAction({
      eventType: "ADMIN_SECURITY_EXPORT",
      severity: status === "confirmed_incident" || status === "escalated" ? "ERROR" : "WARNING",
      action: "update_platform_data_security_incident",
      outcome: status === "confirmed_incident" || status === "escalated" ? "flagged" : "success",
      actorId: auth.user.uid,
      reasonCode: status,
    })
  );

  return json({ ok: true, id, status });
}
