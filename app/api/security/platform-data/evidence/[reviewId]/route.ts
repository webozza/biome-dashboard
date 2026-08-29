import type { NextRequest } from "next/server";
import { db } from "@/lib/server/firebase";
import { requireSecuritySuperadmin } from "@/lib/server/security-guard";
import { SECURITY_COLLECTIONS, serializeDoc } from "@/lib/server/security-platform-data";

export const dynamic = "force-dynamic";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest, context: { params: Promise<{ reviewId: string }> }) {
  const auth = await requireSecuritySuperadmin(req);
  if (!auth.ok) return auth.response;

  const { reviewId } = await context.params;
  const [reviewSnap, incidentsSnap, eventsSnap] = await Promise.all([
    db().collection(SECURITY_COLLECTIONS.reviews).doc(reviewId).get(),
    db().collection(SECURITY_COLLECTIONS.incidents).orderBy("updatedAt", "desc").limit(25).get(),
    db().collection(SECURITY_COLLECTIONS.events).orderBy("createdAt", "desc").limit(25).get(),
  ]);
  const review = reviewSnap.exists ? { id: reviewSnap.id, ...reviewSnap.data() } : null;
  const incidents = incidentsSnap.docs.map((doc) => serializeDoc<Record<string, unknown>>(doc));
  const events = eventsSnap.docs.map((doc) => serializeDoc<Record<string, unknown>>(doc));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Meta auditlog-22.e.iii evidence ${escapeHtml(reviewId)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #ffffff; }
    main { max-width: 1040px; margin: 0 auto; padding: 32px; }
    h1 { font-size: 26px; margin: 0 0 8px; }
    h2 { margin-top: 28px; border-bottom: 1px solid #d1d5db; padding-bottom: 8px; font-size: 18px; }
    p, li, td, th { font-size: 13px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .screen { border: 2px dashed #9ca3af; padding: 18px; margin: 12px 0; min-height: 90px; }
    .muted { color: #6b7280; }
    @media print { button { display: none; } main { padding: 0; } }
  </style>
</head>
<body>
  <main>
    <button onclick="window.print()">Print / Save as PDF</button>
    <h1>Meta auditlog-22.e.iii Active Use Evidence</h1>
    <p class="muted">This print-ready page is a wrapper for real screenshots. It is not a replacement for Google Cloud alert output screenshots.</p>

    <h2>Required screenshots for actual alert output</h2>
    <div class="screen">Paste or place screenshot: Google Cloud Logs Explorer showing the exact structured event, event ID, timestamp, <strong>actual alert output</strong>, and <code>jsonPayload.schema="biome.security.v1"</code>.</div>
    <div class="screen">Paste or place screenshot: Google Cloud Monitoring incident detail showing policy, condition, severity, opened time, and notification state.</div>
    <div class="screen">Paste or place screenshot: alert email/Slack/operations notification with sensitive contact details redacted.</div>

    <h2>Current review record</h2>
    <table>
      <tbody>
        <tr><th>Review ID</th><td>${escapeHtml(reviewId)}</td></tr>
        <tr><th>Status</th><td>${escapeHtml((review as Record<string, unknown> | null)?.status || "Not found")}</td></tr>
        <tr><th>Reviewer</th><td>${escapeHtml((review as Record<string, unknown> | null)?.reviewerEmail || "Server-resolved reviewer required")}</td></tr>
        <tr><th>Findings</th><td>${escapeHtml((review as Record<string, unknown> | null)?.findings || "No completed review loaded")}</td></tr>
      </tbody>
    </table>

    <h2>Recent sanitized incidents</h2>
    <table>
      <thead><tr><th>ID</th><th>Status</th><th>Policy</th><th>Related Events</th></tr></thead>
      <tbody>
        ${incidents
          .map(
            (incident) =>
              `<tr><td>${escapeHtml(incident.id)}</td><td>${escapeHtml(incident.status)}</td><td>${escapeHtml(incident.policyName)}</td><td>${escapeHtml((incident.relatedEventIds as string[] | undefined)?.join(", ") || "")}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>

    <h2>Recent sanitized security events</h2>
    <table>
      <thead><tr><th>Event ID</th><th>Type</th><th>Severity</th><th>Source</th><th>Occurred</th></tr></thead>
      <tbody>
        ${events
          .map(
            (event) =>
              `<tr><td>${escapeHtml(event.eventId || event.id)}</td><td>${escapeHtml(event.eventType)}</td><td>${escapeHtml(event.severity)}</td><td>${escapeHtml(event.backendSource)}</td><td>${escapeHtml(event.occurredAt)}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>

    <h2>Redaction check</h2>
    <ul>
      <li>Redact tokens, cookies, authorization headers, OAuth codes, service-account details, emails, full user IDs, full IPs, and raw Facebook/Instagram payloads.</li>
      <li>Do not redact event type, severity, event ID, incident ID, review period, reviewer role/name, or completion timestamp.</li>
    </ul>
  </main>
</body>
</html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
