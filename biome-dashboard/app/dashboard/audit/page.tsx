"use client";

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { AuthGate } from "@/components/ui/auth-gate";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

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
      render: (r: AuditRow) => (
        <span className="uppercase text-[10px] font-black text-primary tracking-widest">
          {r.source}
        </span>
      ),
    },
    {
      key: "requestType",
      label: "Type",
      render: (r: AuditRow) => (
        <span className="uppercase text-[10px] font-black text-muted tracking-widest">
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
      render: (r: AuditRow) => <StatusBadge status={r.status} />,
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
            <span className="text-[10px] font-bold text-emerald-500">{r.voteAccept}</span>
            <span className="text-[10px] font-bold text-muted">/</span>
            <span className="text-[10px] font-bold text-amber-500">{r.voteIgnore}</span>
            <span className="text-[10px] font-bold text-muted">/</span>
            <span className="text-[10px] font-bold text-red-500">{r.voteRefuse}</span>
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
        <button
          onClick={() => downloadCsv(filtered)}
          disabled={!filtered.length}
          className="px-5 py-2.5 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Download CSV
        </button>
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
          emptyMessage="No audit entries yet"
          emptyDescription="Approvals, rejections, and reviews will show up here as admins work through the queue."
          loading={auditQuery.isLoading}
        />
      </div>
    </div>
  );
}
