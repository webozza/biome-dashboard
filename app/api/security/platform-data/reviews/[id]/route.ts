import type { NextRequest } from "next/server";
import { admin, db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { requireSecuritySuperadmin } from "@/lib/server/security-guard";
import {
  allFourMetaCategoriesReviewed,
  appendSecurityActivity,
  emptyChecklist,
  nextDueDateFrom,
  SECURITY_COLLECTIONS,
} from "@/lib/server/security-platform-data";
import type { SecurityReviewChecklist, SecurityReviewStatus } from "@/lib/security-audit-types";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<SecurityReviewStatus>(["pending", "in_progress", "completed", "overdue"]);

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as {
    status?: unknown;
    findings?: unknown;
    checklist?: Partial<SecurityReviewChecklist>;
    linkedIncidentIds?: unknown;
    periodEnd?: unknown;
  } | null;
  const status = String(body?.status || "in_progress") as SecurityReviewStatus;
  if (!ALLOWED_STATUSES.has(status)) return error("invalid_review_status", 400);

  const checklist = { ...emptyChecklist(), ...(body?.checklist || {}) };
  if (status === "completed" && !allFourMetaCategoriesReviewed(checklist)) {
    return error("allFourMetaCategoriesReviewed_required", 400);
  }

  const findings =
    typeof body?.findings === "string" && body.findings.trim()
      ? body.findings.trim()
      : "No indicators identified";
  const linkedIncidentIds = Array.isArray(body?.linkedIncidentIds)
    ? body.linkedIncidentIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const periodEnd = typeof body?.periodEnd === "string" ? body.periodEnd : new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    reviewerUid: auth.user.uid,
    reviewerEmail: auth.user.email,
    checklist,
    findings,
    linkedIncidentIds,
    incidentCount: linkedIncidentIds.length,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (status === "completed") {
    patch.completedAt = admin.firestore.FieldValue.serverTimestamp();
    patch.nextDueAt = nextDueDateFrom(periodEnd);
  }

  await db().collection(SECURITY_COLLECTIONS.reviews).doc(id).set(patch, { merge: true });
  await appendSecurityActivity({
    type: status === "completed" ? "weekly_review_completed" : "weekly_review_updated",
    targetType: "review",
    targetId: id,
    actorUid: auth.user.uid,
    actorEmail: auth.user.email,
    note: `${status}: ${findings}`,
  });
  return json({ ok: true, id, status });
}
