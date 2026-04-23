"use client";

import { useMemo, useState } from "react";
import { ScrollText, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { AuthGate } from "@/components/ui/auth-gate";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAuthStore } from "@/lib/stores/auth-store";
import { readJson } from "@/lib/http";

type AuditRow = {
  id: string;
  requestId: string;
  requestType: "own" | "duality" | "verification";
  source: "content" | "box" | "duality" | "verification" | "report";
  ownerUser: string;
  taggedUser: string | null;
  status: string;
  actorName: string;
  note: string;
  voteAccept: number;
  voteIgnore: number;
  voteRefuse: number;
  rejectionReason: string | null;
  createdAt: string;
};

type AuditResponse = { items: AuditRow[]; total: number };

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toCsv(rows: AuditRow[]): string {
  const headers = [
    "id",
    "requestId",
    "requestType",
    "source",
    "ownerUser",
    "taggedUser",
    "status",
    "actorName",
    "note",
    "voteAccept",
    "voteIgnore",
    "voteRefuse",
    "rejectionReason",
    "createdAt",
  ];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.requestId,
        r.requestType,
        r.source,
        r.ownerUser,
        r.taggedUser || "",
        r.status,
        r.actorName,
        r.note,
        r.voteAccept,
        r.voteIgnore,
        r.voteRefuse,
        r.rejectionReason || "",
        r.createdAt,
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

function downloadCsv(rows: AuditRow[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const itemsPerPage = 15;

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const resp = await fetch("/api/audit", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ ids }),
      });
      return readJson<{ dismissed: number }>(resp);
    },
    onSuccess: (_, ids) => {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["audit", "ledger"] });
    },
  });

  const auditQuery = useQuery({
    queryKey: ["audit", "ledger"],
    queryFn: async () => {
      const resp = await fetch("/api/audit", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<AuditResponse>(resp);
    },
    enabled: Boolean(apiToken),
    refetchInterval: 60_000,
  });

  const allRows = auditQuery.data?.items || [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((r) => {
      if (q) {
        const hay = [r.id, r.requestId, r.ownerUser, r.taggedUser || "", r.actorName, r.note, r.status]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.status && filters.status !== "all" && r.status !== filters.status) return false;
      if (filters.requestType && filters.requestType !== "all" && r.requestType !== filters.requestType) return false;
      if (filters.source && filters.source !== "all" && r.source !== filters.source) return false;
      return true;
    });
  }, [allRows, searchQuery, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!apiToken) {
    return <AuthGate icon={ScrollText} title="Audit Ledger" subtitle="Sign in to view the history of platform changes" />;
  }

  const columns = [
    {
      key: "source",
      label: "Source",
      render: (r: AuditRow) => {
        const sourceColors: Record<string, string> = {
          content: "#06b6d4",
          box: "#f59e0b",
          duality: "#d946ef",
          verification: "#059669",
          report: "#ef4444",
        };
        const color = sourceColors[r.source] || "#64748b";
        return (
          <span
            className="inline-flex items-center rounded-lg border px-2 py-0.5 uppercase text-[10px] font-black tracking-widest"
            style={{
              backgroundColor: `${color}1a`,
              borderColor: `${color}33`,
              color,
            }}
          >
            {r.source}
          </span>
        );
      },
    },
    {
      key: "requestType",
      label: "Type",
      render: (r: AuditRow) => (
        <span className="inline-flex items-center rounded-lg bg-[#64748b]/10 border border-[#64748b]/20 px-2 py-0.5 uppercase text-[10px] font-black text-[#64748b] tracking-widest">
          {r.requestType}
        </span>
      ),
    },
    {
      key: "requestId",
      label: "Request",
      render: (r: AuditRow) => (
        <span className="font-mono text-[10px] bg-surface-hover px-1.5 py-0.5 rounded border border-border">
          {r.requestId.slice(0, 16)}
          {r.requestId.length > 16 ? "…" : ""}
        </span>
      ),
    },
    {
      key: "ownerUser",
      label: "Owner",
      render: (r: AuditRow) => <p className="font-bold text-main text-sm">{r.ownerUser}</p>,
    },
    {
      key: "taggedUser",
      label: "Tagged",
      render: (r: AuditRow) =>
        r.taggedUser ? (
          <p className="text-sm text-muted">{r.taggedUser}</p>
        ) : (
          <span className="text-muted opacity-30">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: AuditRow) =>
        r.status ? <StatusBadge status={r.status} /> : <span className="text-muted opacity-40">—</span>,
    },
    {
      key: "actorName",
      label: "Actor",
      render: (r: AuditRow) => <span className="text-xs font-medium text-main">{r.actorName}</span>,
    },
    {
      key: "votes",
      label: "Votes",
      render: (r: AuditRow) =>
        r.voteAccept + r.voteIgnore + r.voteRefuse > 0 ? (
          <div className="flex gap-1">
            <span className="text-[10px] font-bold text-primary">{r.voteAccept}</span>
            <span className="text-[10px] font-bold text-muted">/</span>
            <span className="text-[10px] font-bold text-[#f59e0b]">{r.voteIgnore}</span>
            <span className="text-[10px] font-bold text-muted">/</span>
            <span className="text-[10px] font-bold text-[#ef4444]">{r.voteRefuse}</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted opacity-40">—</span>
        ),
    },
    {
      key: "createdAt",
      label: "When",
      render: (r: AuditRow) => (
        <span className="text-muted text-[11px] font-bold tabular-nums">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: AuditRow) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete([r.id]);
          }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/10 border border-transparent hover:border-[#ef4444]/20 transition-colors"
          title="Delete row"
          aria-label="Delete row"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <ScrollText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-main">Audit Ledger</h1>
            <p className="text-sm font-medium italic text-muted">
              History of approvals, reviews, and votes across the platform
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setPendingDelete(selectedIds)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#ef4444]/15 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selectedIds.length}
            </button>
          )}
          <button
            onClick={() => downloadCsv(filtered)}
            disabled={!filtered.length}
            className="px-5 py-2.5 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={(v) => {
              setSearchQuery(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search by user, request id, actor, or note..."
            filters={[
              {
                key: "status",
                label: "Status",
                options: [
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                  { value: "actioned", label: "Actioned" },
                  { value: "dismissed", label: "Dismissed" },
                  { value: "reviewed", label: "Reviewed" },
                  { value: "removed", label: "Removed" },
                  { value: "cancelled", label: "Cancelled" },
                ],
              },
              {
                key: "requestType",
                label: "Type",
                options: [
                  { value: "own", label: "Own" },
                  { value: "duality", label: "Duality" },
                  { value: "verification", label: "Verification" },
                ],
              },
              {
                key: "source",
                label: "Source",
                options: [
                  { value: "content", label: "Content" },
                  { value: "box", label: "Box" },
                  { value: "duality", label: "Duality" },
                  { value: "verification", label: "Verification" },
                  { value: "report", label: "Report" },
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
            onExport={() => downloadCsv(filtered)}
          />
        </div>

        {auditQuery.isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 mb-4">
            Failed to load audit ledger: {(auditQuery.error as Error).message}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={paged}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={itemsPerPage}
          onPageChange={setCurrentPage}
          getId={(r) => r.id}
          selectedItems={selectedIds}
          onToggleItem={(id) =>
            setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onSelectAll={(ids) => setSelectedIds(ids)}
          emptyMessage="No audit entries yet"
          emptyDescription="Approvals, rejections, and reviews will show up here as admins work through the queue."
          loading={auditQuery.isLoading}
        />
      </div>

      <ConfirmModal
        open={Boolean(pendingDelete && pendingDelete.length > 0)}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} audit entries?`
            : "Delete audit entry?"
        }
        message={
          pendingDelete && pendingDelete.length > 1 ? (
            <>
              This hides <strong>{pendingDelete.length}</strong> selected audit entries from the ledger.
              The underlying request records are unaffected.
            </>
          ) : (
            <>This hides the selected audit entry from the ledger. The underlying request record is unaffected.</>
          )
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) void deleteMutation.mutateAsync(pendingDelete);
        }}
        onCancel={() => {
          if (!deleteMutation.isPending) setPendingDelete(null);
        }}
      />
    </div>
  );
}
