import type { NextRequest } from "next/server";
import { admin, db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { logSecurityView, requireSecuritySuperadmin } from "@/lib/server/security-guard";
import {
  allFourMetaCategoriesReviewed,
  appendSecurityActivity,
  emptyChecklist,
  listSecurityDocs,
  nextDueDateFrom,
  SECURITY_COLLECTIONS,
} from "@/lib/server/security-platform-data";
import type { SecurityReview, SecurityReviewChecklist } from "@/lib/security-audit-types";

export const dynamic = "force-dynamic";

function defaultPeriod() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

export async function GET(req: NextRequest) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const reviews = await listSecurityDocs<SecurityReview>(SECURITY_COLLECTIONS.reviews, 100);
  await logSecurityView(req, auth.user, "view_platform_data_weekly_reviews", reviews.length);
  return json({ items: reviews, total: reviews.length });
}

export async function POST(req: NextRequest) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as {
    periodStart?: unknown;
    periodEnd?: unknown;
    findings?: unknown;
    checklist?: Partial<SecurityReviewChecklist>;
    linkedIncidentIds?: unknown;
    complete?: unknown;
  } | null;
  const fallback = defaultPeriod();
  const periodStart = typeof body?.periodStart === "string" ? body.periodStart : fallback.periodStart;
  const periodEnd = typeof body?.periodEnd === "string" ? body.periodEnd : fallback.periodEnd;
  const checklist = { ...emptyChecklist(), ...(body?.checklist || {}) };
  const complete = body?.complete === true;
  if (complete && !allFourMetaCategoriesReviewed(checklist)) {
    return error("allFourMetaCategoriesReviewed_required", 400);
  }

  const findings =
    typeof body?.findings === "string" && body.findings.trim()
      ? body.findings.trim()
      : "No indicators identified";
  const linkedIncidentIds = Array.isArray(body?.linkedIncidentIds)
    ? body.linkedIncidentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const id = `weekly-${periodEnd.slice(0, 10)}`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const review = {
    periodStart,
    periodEnd,
    dueAt: nextDueDateFrom(periodStart),
    status: complete ? "completed" : "in_progress",
    reviewerUid: auth.user.uid,
    reviewerEmail: auth.user.email,
    checklist,
    eventCount: 0,
    incidentCount: linkedIncidentIds.length,
    findings,
    linkedIncidentIds,
    completedAt: complete ? now : null,
    nextDueAt: complete ? nextDueDateFrom(periodEnd) : null,
    createdAt: now,
    updatedAt: now,
  };

  await db().collection(SECURITY_COLLECTIONS.reviews).doc(id).set(review, { merge: true });
  await appendSecurityActivity({
    type: complete ? "weekly_review_completed" : "weekly_review_started",
    targetType: "review",
    targetId: id,
    actorUid: auth.user.uid,
    actorEmail: auth.user.email,
    note: complete ? `Completed weekly review: ${findings}` : "Started weekly review",
  });
  return json({ ok: true, id, status: review.status });
}
