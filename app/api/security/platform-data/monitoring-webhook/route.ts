import type { NextRequest } from "next/server";
import { admin, db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { SECURITY_COLLECTIONS } from "@/lib/server/security-platform-data";

export const dynamic = "force-dynamic";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  const expected = (process.env.SECURITY_MONITORING_WEBHOOK_TOKEN || "").trim();
  const provided = asString(req.headers.get("x-security-webhook-token"));
  if (!expected || provided !== expected) return error("unauthorized", 401);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const incident = (body?.incident || body || {}) as Record<string, unknown>;
  const incidentId =
    asString(incident.incident_id) ||
    asString(incident.id) ||
    asString(incident.name).replace(/\//g, "_") ||
    `monitoring-${Date.now()}`;
  const policyName = asString(incident.policy_name) || asString(incident.policyName) || "Google Cloud Monitoring alert";
  const url = asString(incident.url) || asString(incident.incident_url) || null;
  const state = asString(incident.state).toLowerCase();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db()
    .collection(SECURITY_COLLECTIONS.incidents)
    .doc(incidentId)
    .set(
      {
        cloudIncidentId: incidentId,
        cloudIncidentUrl: url,
        policyName,
        severity: "WARNING",
        backendSource: "dashboard-vps",
        relatedEventIds: [],
        notificationState: "received",
        reviewState: state === "closed" ? "resolved" : "open",
        status: state === "closed" ? "resolved" : "open",
        openedAt: asString(incident.started_at) || new Date().toISOString(),
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    );

  return json({ ok: true, incidentId });
}
