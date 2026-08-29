"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { AuthGate } from "@/components/ui/auth-gate";
import { MetricCard } from "@/components/ui/metric-card";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { SecurityAuditEvent, SecurityIncident, SecurityReviewChecklist } from "@/lib/security-audit-types";

type Summary = {
  lastCompletedReview: { id: string; completedAt?: string; nextDueAt?: string } | null;
  nextReviewDeadline: string | null;
  openIncidents: number;
  criticalHighEventsLast7Days: number;
  platformDataReadsLast7Days: number;
  failedDeniedAccessLast7Days: number;
  backendLoggingHealth: { firebaseFunctions: boolean; dashboardVps: boolean; hasSecurityEvents: boolean };
  totals: { events: number; incidents: number; reviews: number };
};

type Incident = SecurityIncident & { id: string };
type Review = { id: string; status: string; periodStart: string; periodEnd: string; dueAt: string; reviewerEmail?: string | null; findings?: string };

const tabs = ["Security Events", "Incidents", "Weekly Reviews", "Evidence Export"] as const;

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const auth = await authHeaders();
  if (auth.authorization) headers.set("authorization", auth.authorization);
  const resp = await fetch(url, { ...init, headers });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error || "Request failed");
  return data as T;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PlatformDataMonitoringPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Security Events");
  const [testConfirmation, setTestConfirmation] = useState("");
  const [reviewFindings, setReviewFindings] = useState("No indicators identified");
  const [incidentNotes, setIncidentNotes] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<SecurityReviewChecklist>({
    unauthorizedAuthReviewed: false,
    accessControlReviewed: false,
    exploitationReviewed: false,
    extractionReviewed: false,
  });

  const summary = useQuery({
    queryKey: ["security-platform-data", "summary"],
    queryFn: () => fetchJson<Summary>("/api/security/platform-data/summary"),
    enabled: Boolean(user?.isAdmin),
    refetchInterval: 60_000,
  });
  const events = useQuery({
    queryKey: ["security-platform-data", "events"],
    queryFn: () => fetchJson<{ items: SecurityAuditEvent[] }>("/api/security/platform-data/events"),
    enabled: Boolean(user?.isAdmin),
  });
  const incidents = useQuery({
    queryKey: ["security-platform-data", "incidents"],
    queryFn: () => fetchJson<{ items: Incident[] }>("/api/security/platform-data/incidents"),
    enabled: Boolean(user?.isAdmin),
  });
  const reviews = useQuery({
    queryKey: ["security-platform-data", "reviews"],
    queryFn: () => fetchJson<{ items: Review[] }>("/api/security/platform-data/reviews"),
    enabled: Boolean(user?.isAdmin),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["security-platform-data"] });
  };

  const testMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ ok: true; event: SecurityAuditEvent; incidentId: string }>("/api/security/platform-data/test-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmation: testConfirmation,
          reason: "Safe validation event for Meta auditlog-22.e.iii active alert evidence.",
        }),
      }),
    onSuccess: invalidate,
  });

  const incidentMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes: string }) =>
      fetchJson(`/api/security/platform-data/incidents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, reviewNotes }),
      }),
    onSuccess: invalidate,
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ ok: true; id: string }>("/api/security/platform-data/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          complete: true,
          checklist,
          findings: reviewFindings,
          linkedIncidentIds: incidents.data?.items?.map((incident) => incident.id) || [],
        }),
      }),
    onSuccess: invalidate,
  });

  const latestReviewId = useMemo(() => reviews.data?.items?.[0]?.id || "weekly-current", [reviews.data?.items]);

  if (!user?.isAdmin) {
    return <AuthGate icon={ShieldAlert} title="Platform Data Monitoring" subtitle="Superadmin access required" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-main tracking-tight">Platform Data Monitoring</h1>
          <p className="text-sm text-muted">Meta auditlog-22.e.iii security events, incidents, and weekly reviews.</p>
        </div>
        <a
          className="rounded-lg border border-border px-3 py-2 text-sm font-bold text-main hover:bg-surface-hover"
          href={`/api/security/platform-data/evidence/${encodeURIComponent(latestReviewId)}`}
          target="_blank"
          rel="noreferrer"
        >
          Evidence Export
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Open Incidents" value={summary.data?.openIncidents ?? 0} icon={Bell} color="#ef4444" loading={summary.isLoading} />
        <MetricCard title="Critical/High 7d" value={summary.data?.criticalHighEventsLast7Days ?? 0} icon={AlertTriangle} color="#f97316" loading={summary.isLoading} />
        <MetricCard title="Meta Reads 7d" value={summary.data?.platformDataReadsLast7Days ?? 0} icon={ShieldCheck} color="#0ea5e9" loading={summary.isLoading} />
        <MetricCard title="Next Review" value={formatDate(summary.data?.nextReviewDeadline).split(",")[0]} icon={FileText} color="#10b981" loading={summary.isLoading} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item}
            className={`px-3 py-2 text-sm font-bold ${tab === item ? "border-b-2 border-primary text-primary" : "text-muted"}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Security Events" && (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-black uppercase text-muted">Firebase Functions Health</p>
              <p className="mt-2 text-sm font-bold">{summary.data?.backendLoggingHealth.firebaseFunctions ? "Events received" : "Waiting for production event"}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-black uppercase text-muted">Dashboard VPS Health</p>
              <p className="mt-2 text-sm font-bold">{summary.data?.backendLoggingHealth.dashboardVps ? "Events received" : "Waiting for production event"}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-black uppercase text-muted">Failed/Denied 7d</p>
              <p className="mt-2 text-sm font-bold">{summary.data?.failedDeniedAccessLast7Days ?? 0}</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-hover text-left text-xs uppercase text-muted">
                <tr><th className="p-3">Time</th><th>Type</th><th>Severity</th><th>Source</th><th>Outcome</th><th>Event ID</th></tr>
              </thead>
              <tbody>
                {(events.data?.items || []).map((event) => (
                  <tr key={event.eventId} className="border-t border-border">
                    <td className="p-3">{formatDate(event.occurredAt)}</td>
                    <td>{event.eventType}</td>
                    <td>{event.severity}</td>
                    <td>{event.backendSource}</td>
                    <td>{event.outcome}</td>
                    <td className="font-mono text-xs">{event.eventId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "Incidents" && (
        <section className="space-y-3">
          {(incidents.data?.items || []).map((incident) => (
            <div key={incident.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-main">{incident.policyName}</p>
                  <p className="text-xs text-muted">Status: {incident.status} | Related events: {incident.relatedEventIds?.join(", ") || "-"}</p>
                </div>
                <button
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  disabled={incidentMutation.isPending}
                  onClick={() =>
                    incidentMutation.mutate({
                      id: incident.id,
                      status: "test_event",
                      reviewNotes: incidentNotes[incident.id] || "Safe validation event. No unauthorized access identified.",
                    })
                  }
                >
                  Resolve Test Event
                </button>
              </div>
              <textarea
                className="mt-3 w-full rounded-lg border border-border bg-surface p-3 text-sm"
                value={incidentNotes[incident.id] || ""}
                placeholder="Review notes"
                onChange={(event) => setIncidentNotes((prev) => ({ ...prev, [incident.id]: event.target.value }))}
              />
            </div>
          ))}
        </section>
      )}

      {tab === "Weekly Reviews" && (
        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-border p-4">
            <h2 className="font-black text-main">Complete Current Weekly Review</h2>
            {Object.entries({
              unauthorizedAuthReviewed: "Unauthorized or anomalous authentication activity reviewed",
              accessControlReviewed: "Access-control failures or privilege-escalation attempts reviewed",
              exploitationReviewed: "Signs of application exploitation or abuse reviewed",
              extractionReviewed: "Unusual data-access or extraction patterns reviewed",
            }).map(([key, label]) => (
              <label key={key} className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(checklist[key as keyof SecurityReviewChecklist])}
                  onChange={(event) => setChecklist((prev) => ({ ...prev, [key]: event.target.checked }))}
                />
                {label}
              </label>
            ))}
            <textarea className="mt-4 w-full rounded-lg border border-border bg-surface p-3 text-sm" value={reviewFindings} onChange={(event) => setReviewFindings(event.target.value)} />
            <button className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white" onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
              Complete Weekly Review
            </button>
          </div>
          <div className="rounded-lg border border-border p-4">
            <h2 className="font-black text-main">Review History</h2>
            {(reviews.data?.items || []).map((review) => (
              <div key={review.id} className="mt-3 border-t border-border pt-3 text-sm">
                <p className="font-bold">{review.id} - {review.status}</p>
                <p className="text-muted">{formatDate(review.periodStart)} to {formatDate(review.periodEnd)}</p>
                <p className="text-muted">Reviewer: {review.reviewerEmail || "-"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "Evidence Export" && (
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-black text-main">Evidence Export</h2>
          <p className="mt-2 text-sm text-muted">Use this only after Google Cloud Logs Explorer, Monitoring incident, notification, incident review, and weekly review are all visible.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-lg border border-border px-3 py-2 text-sm font-bold"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              Generate Safe Test Event
            </button>
            <input
              className="min-w-[280px] rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={testConfirmation}
              onChange={(event) => setTestConfirmation(event.target.value)}
              placeholder="GENERATE SECURITY TEST EVENT"
            />
            <a className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white" href={`/api/security/platform-data/evidence/${encodeURIComponent(latestReviewId)}`} target="_blank" rel="noreferrer">
              Open Print Page
            </a>
          </div>
          {testMutation.data?.event ? (
            <div className="mt-4 rounded-lg border border-border p-3 text-sm">
              <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-primary" />Safe event created: <span className="font-mono">{testMutation.data.event.eventId}</span></p>
              <p className="text-muted">Next: find this event ID in Google Cloud Logs Explorer and wait for Monitoring to open the real incident.</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
