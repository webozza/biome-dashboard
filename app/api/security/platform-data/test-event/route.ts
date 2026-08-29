import type { NextRequest } from "next/server";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { requireSecuritySuperadmin } from "@/lib/server/security-guard";
import { auditInputForAdminAction, writeSecurityAuditEvent } from "@/lib/server/security-audit";
import { appendSecurityActivity, SECURITY_COLLECTIONS, upsertTestIncident } from "@/lib/server/security-platform-data";

export const dynamic = "force-dynamic";

const CONFIRMATION = "GENERATE SECURITY TEST EVENT";
const cooldown = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as { confirmation?: unknown; reason?: unknown } | null;
  if (body?.confirmation !== CONFIRMATION) {
    return error("confirmation_required", 400, { required: CONFIRMATION });
  }

  const recent = await db()
    .collection(SECURITY_COLLECTIONS.events)
    .where("eventType", "==", "SECURITY_PIPELINE_TEST")
    .where("backendSource", "==", "dashboard-vps")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  const lastCreatedAt = recent.docs[0]?.data()?.createdAt;
  const lastMillis =
    lastCreatedAt && typeof lastCreatedAt.toMillis === "function" ? lastCreatedAt.toMillis() : 0;
  if (lastMillis && Date.now() - lastMillis < cooldown) {
    return error("cooldown_active", 429, {
      retryAfterSeconds: Math.ceil((cooldown - (Date.now() - lastMillis)) / 1000),
    });
  }

  const event = await writeSecurityAuditEvent(
    auditInputForAdminAction({
      eventType: "SECURITY_PIPELINE_TEST",
      severity: "WARNING",
      provider: "meta",
      action: "validate_alert_pipeline",
      outcome: "flagged",
      actorId: auth.user.uid,
      reasonCode: "safe_manual_validation",
      synthetic: true,
    })
  );
  const incidentId = await upsertTestIncident(event);
  await appendSecurityActivity({
    type: "security_pipeline_test_created",
    targetType: "event",
    targetId: event.eventId,
    actorUid: auth.user.uid,
    actorEmail: auth.user.email,
    note:
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Safe validation event for Meta auditlog-22.e.iii alert pipeline evidence.",
  });

  return json({ ok: true, event, incidentId });
}
