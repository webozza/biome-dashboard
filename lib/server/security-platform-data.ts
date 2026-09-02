import { admin, db } from "./firebase";
import type {
  SecurityAuditEvent,
  SecurityIncidentStatus,
  SecurityReviewChecklist,
  SecurityReviewStatus,
} from "@/lib/security-audit-types";

export const SECURITY_COLLECTIONS = {
  events: "securityAuditEvents",
  incidents: "securityIncidents",
  reviews: "securityReviews",
  activity: "securityReviewActivity",
};

export function toIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

export function serializeDoc<T extends Record<string, unknown>>(doc: FirebaseFirestore.QueryDocumentSnapshot): T & { id: string } {
  const data = doc.data();
  const serialized: Record<string, unknown> = { id: doc.id };
  for (const [key, value] of Object.entries(data)) {
    serialized[key] = toIso(value) || value;
  }
  return serialized as T & { id: string };
}

export async function listSecurityDocs<T extends Record<string, unknown>>(
  collection: string,
  limit = 100,
  orderBy = "createdAt"
): Promise<(T & { id: string })[]> {
  const snap = await db().collection(collection).orderBy(orderBy, "desc").limit(limit).get();
  return snap.docs.map((doc) => serializeDoc<T>(doc));
}

export async function appendSecurityActivity(payload: {
  type: string;
  targetType: "incident" | "review" | "event";
  targetId: string;
  actorUid: string;
  actorEmail: string | null;
  note: string;
}) {
  await db().collection(SECURITY_COLLECTIONS.activity).add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export function emptyChecklist(): SecurityReviewChecklist {
  return {
    unauthorizedAuthReviewed: false,
    accessControlReviewed: false,
    exploitationReviewed: false,
    extractionReviewed: false,
  };
}

export function allFourMetaCategoriesReviewed(checklist: SecurityReviewChecklist): boolean {
  return (
    checklist.unauthorizedAuthReviewed === true &&
    checklist.accessControlReviewed === true &&
    checklist.exploitationReviewed === true &&
    checklist.extractionReviewed === true
  );
}

export function nextDueDateFrom(periodEndIso: string): string {
  const base = new Date(periodEndIso);
  const start = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function upsertTestIncident(event: SecurityAuditEvent) {
  const incidentId = `test-${event.eventId}`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db()
    .collection(SECURITY_COLLECTIONS.incidents)
    .doc(incidentId)
    .set(
      {
        cloudIncidentId: null,
        cloudIncidentUrl: null,
        policyName: "Meta Platform Data security pipeline validation",
        severity: event.severity,
        status: "open" satisfies SecurityIncidentStatus,
        backendSource: event.backendSource,
        relatedEventIds: [event.eventId],
        notificationState: "awaiting_cloud_monitoring_incident",
        reviewState: "open",
        openedAt: event.occurredAt,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  return incidentId;
}

export function normalizeReviewStatus(value: unknown): SecurityReviewStatus {
  return value === "in_progress" || value === "completed" || value === "overdue" ? value : "pending";
}
