"use client";

import { useMemo, useState } from "react";
import {
  ShieldAlert,
  Flag,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  Mail,
  Calendar,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AuthGate } from "@/components/ui/auth-gate";
import { useAuthStore } from "@/lib/stores/auth-store";
import { readJson } from "@/lib/http";

type ReportStatus = "pending" | "reviewed" | "dismissed" | "actioned";

type Report = {
  id: string;
  reporterId: string;
  reporterEmail: string | null;
  contentType: string;
  contentId: string;
  contentPath: string;
  authorId: string;
  reason: string;
  additionalInfo: string | null;
  status: ReportStatus;
  createdAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNotes: string | null;
};

type ReportsResponse = {
  items: Report[];
  total: number;
  counts: { pending: number; reviewed: number; dismissed: number; actioned: number };
};

type TabKey = "pending" | "reviewed" | "all";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate_speech: "Hate speech",
  nudity_sexual: "Nudity / Sexual",
  violence: "Violence",
  false_information: "False information",
  other: "Other",
};

const REASON_OPTIONS = Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }));

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ModerationPage() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Report | null>(null);
  const pageSize = 10;

  const reportsQuery = useQuery({
    queryKey: ["moderation", "reports", tab],
    queryFn: async () => {
      const params = new URLSearchParams({ status: tab });
      const resp = await fetch(`/api/moderation/reports?${params}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<ReportsResponse>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: ReportStatus; adminNotes?: string }) => {
      const resp = await fetch(`/api/moderation/reports/${id}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status, adminNotes: adminNotes ?? null, reviewerId: currentUser?.uid || "admin" }),
      });
      return readJson<unknown>(resp);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] }),
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (report: Report) => {
      const resp = await fetch(`/api/moderation/reports/${report.id}/delete-content`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reviewerId: currentUser?.uid || "admin" }),
      });
      return readJson<{ deleted: boolean; alreadyGone: boolean }>(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
      setPendingDelete(null);
      setSelectedId(null);
    },
  });

  const allItems = reportsQuery.data?.items || [];
  const counts = reportsQuery.data?.counts || { pending: 0, reviewed: 0, dismissed: 0, actioned: 0 };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allItems.filter((r) => {
      if (q) {
        const hay = [r.id, r.reporterEmail, r.reporterId, r.authorId, r.contentId, r.contentPath, r.additionalInfo, r.reason]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.reason && filters.reason !== "all" && r.reason !== filters.reason) return false;
      if (filters.contentType && filters.contentType !== "all" && r.contentType !== filters.contentType) return false;
      return true;
    });
  }, [allItems, searchQuery, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = useMemo(() => allItems.find((r) => r.id === selectedId) || null, [allItems, selectedId]);

  if (!apiToken) {
    return <AuthGate icon={ShieldAlert} title="Safety & Moderation" subtitle="Sign in to review content reports" />;
  }

  const columns = [
    {
      key: "contentType",
      label: "Type",
      render: (r: Report) => (
        <span className="capitalize text-[10px] font-bold text-main px-2 py-0.5 bg-surface-hover rounded border border-border">
          {r.contentType || "—"}
        </span>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (r: Report) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
            <Flag className="w-3 h-3" />
            {REASON_LABELS[r.reason] || r.reason || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "reporter",
      label: "Reporter",
      render: (r: Report) => (
        <div className="min-w-0">
          <p className="text-xs font-bold text-main truncate">{r.reporterEmail || r.reporterId || "Anonymous"}</p>
          {r.additionalInfo ? (
            <p className="text-[11px] text-muted italic truncate">&ldquo;{r.additionalInfo}&rdquo;</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "contentPath",
      label: "Content",
      render: (r: Report) => (
        <code className="text-[10px] text-muted font-mono truncate block max-w-[260px]">{r.contentPath || "—"}</code>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: Report) => <StatusBadge status={r.status} />,
    },
    {
      key: "createdAt",
      label: "When",
      render: (r: Report) => <span className="text-[11px] text-muted tabular-nums">{timeAgo(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-main">Safety & Moderation</h1>
          <p className="text-sm font-medium italic text-muted">
            Review content reports submitted by users and take action on offending posts or reels.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <TileButton
          label="Pending"
          value={counts.pending}
          tone="amber"
          active={tab === "pending"}
          onClick={() => {
            setTab("pending");
            setCurrentPage(1);
          }}
        />
        <TileButton
          label="Reviewed"
          value={counts.reviewed + counts.dismissed + counts.actioned}
          tone="muted"
          active={tab === "reviewed"}
          onClick={() => {
            setTab("reviewed");
            setCurrentPage(1);
          }}
        />
        <TileButton
          label="Actioned"
          value={counts.actioned}
          tone="primary"
          active={false}
          onClick={() => {
            setTab("reviewed");
            setFilters((f) => ({ ...f }));
            setCurrentPage(1);
          }}
        />
        <TileButton
          label="All"
          value={counts.pending + counts.reviewed + counts.dismissed + counts.actioned}
          tone="neutral"
          active={tab === "all"}
          onClick={() => {
            setTab("all");
            setCurrentPage(1);
          }}
        />
      </div>

      <div className="card">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={(v) => {
              setSearchQuery(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search reporter, author, content id, or details..."
            filters={[
              { key: "reason", label: "Reason", options: REASON_OPTIONS },
              {
                key: "contentType",
                label: "Content",
                options: [
                  { value: "post", label: "Post" },
                  { value: "reel", label: "Reel" },
                ],
              },
            ]}
            activeFilters={filters}
            onFilterChange={(key, value) => {
              setFilters((current) => ({ ...current, [key]: value }));
              setCurrentPage(1);
            }}
            onClearFilters={() => {
              setFilters({});
              setCurrentPage(1);
            }}
          />
        </div>

        {reportsQuery.isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 mb-4">
            Failed to load reports: {(reportsQuery.error as Error).message}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={rows}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          getId={(r) => r.id}
          onRowClick={(r) => setSelectedId(r.id)}
          emptyMessage={
            tab === "pending"
              ? "No pending reports"
              : tab === "reviewed"
                ? "No reviewed reports"
                : "No reports"
          }
          emptyDescription={
            tab === "pending" && counts.reviewed + counts.dismissed + counts.actioned > 0
              ? `All caught up. ${counts.reviewed + counts.dismissed + counts.actioned} report(s) in Reviewed — click the tile above to view.`
              : "Nothing to show right now."
          }
          loading={reportsQuery.isLoading}
        />
      </div>

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? `Report ${selected.id.slice(0, 8)}…` : "Report"}
      >
        {selected && (
          <div className="space-y-6 p-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Content Type" value={<span className="capitalize">{selected.contentType}</span>} />
              <Field label="Status" value={<StatusBadge status={selected.status} />} />
              <Field
                label="Reason"
                value={
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                    <Flag className="w-3 h-3" />
                    {REASON_LABELS[selected.reason] || selected.reason || "—"}
                  </span>
                }
              />
              <Field label="Submitted" value={<span>{formatDate(selected.createdAt)}</span>} />
            </div>

            {selected.additionalInfo ? (
              <div className="p-4 rounded-2xl border border-border bg-background">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Reporter details</p>
                <p className="text-sm italic text-main leading-relaxed">&ldquo;{selected.additionalInfo}&rdquo;</p>
              </div>
            ) : null}

            <div className="p-4 rounded-2xl border border-border bg-surface space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Parties</p>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-muted" />
                <span className="text-main font-semibold truncate">
                  {selected.reporterEmail || selected.reporterId || "Anonymous"}
                </span>
                <span className="text-[10px] text-muted ml-auto">reporter</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-3.5 h-3.5 text-muted" />
                <code className="text-xs text-main font-mono truncate">{selected.authorId || "—"}</code>
                <span className="text-[10px] text-muted ml-auto">author</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="w-3.5 h-3.5 text-muted" />
                <code className="text-[11px] text-muted font-mono truncate">{selected.contentPath || "—"}</code>
              </div>
            </div>

            {selected.reviewedAt ? (
              <div className="p-4 rounded-2xl border border-border bg-background space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Review log</p>
                <p className="text-xs text-main flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {formatDate(selected.reviewedAt)}
                  {selected.reviewedBy ? <span className="text-muted ml-2">by {selected.reviewedBy}</span> : null}
                </p>
                {selected.adminNotes ? (
                  <p className="text-xs text-muted italic">&ldquo;{selected.adminNotes}&rdquo;</p>
                ) : null}
              </div>
            ) : null}

            {selected.status === "pending" ? (
              <div className="pt-2 border-t border-border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      updateStatusMutation.mutate({ id: selected.id, status: "dismissed" })
                    }
                    disabled={updateStatusMutation.isPending}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-surface text-xs font-bold text-muted hover:bg-surface-hover hover:text-main transition-all active:scale-95 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                  <button
                    onClick={() =>
                      updateStatusMutation.mutate({ id: selected.id, status: "actioned" })
                    }
                    disabled={updateStatusMutation.isPending}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold hover:bg-amber-500/15 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Take Action
                  </button>
                </div>
                <button
                  onClick={() => setPendingDelete(selected)}
                  disabled={!selected.contentPath || deleteContentMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleteContentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Content
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => updateStatusMutation.mutate({ id: selected.id, status: "reviewed" })}
                  disabled={updateStatusMutation.isPending || selected.status === "reviewed"}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-xs font-bold text-muted hover:text-main hover:bg-surface-hover transition-all disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Mark as reviewed
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete reported content?"
        message={
          <span>
            This will permanently delete the {pendingDelete?.contentType || "content"} at{" "}
            <code className="text-[11px]">{pendingDelete?.contentPath}</code>. The report will be marked as{" "}
            <strong>actioned</strong>. This cannot be undone.
          </span>
        }
        confirmLabel={deleteContentMutation.isPending ? "Deleting…" : "Delete Content"}
        tone="danger"
        loading={deleteContentMutation.isPending}
        onConfirm={() => pendingDelete && deleteContentMutation.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function TileButton({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: "amber" | "primary" | "muted" | "neutral";
  active: boolean;
  onClick: () => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: "text-amber-500",
    primary: "text-primary",
    muted: "text-muted",
    neutral: "text-main",
  };
  return (
    <button
      onClick={onClick}
      className={`card p-5 text-left transition-all ${
        active ? "border-primary/40 ring-2 ring-primary/20 shadow-lg" : "hover:border-primary/20"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-3xl font-extrabold mt-1 ${toneClasses[tone]}`}>{value}</p>
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">{label}</p>
      <div className="text-sm font-semibold text-main">{value}</div>
    </div>
  );
}
