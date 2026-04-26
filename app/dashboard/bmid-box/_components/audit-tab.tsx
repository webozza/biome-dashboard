"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAuthStore } from "@/lib/stores/auth-store";
import { type BmidBoxAuditRow } from "@/lib/bmid-box-client";
import { readJson } from "@/lib/http";
import { formatDateTime } from "@/lib/format";

export function AuditTab() {
  const apiToken = useAuthStore((state) => state.apiToken);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const pageSize = 12;

  const dismissRows = (ids: string[]) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    setPendingDelete(null);
  };

  const query = useQuery({
    queryKey: ["bmid-box", "audit"],
    queryFn: async () => {
      const resp = await fetch("/api/bmid-box/audit", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ items: BmidBoxAuditRow[] }>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (query.data?.items || []).filter((row) => {
      if (dismissedIds.has(row.id)) return false;
      const haystack = [row.requestId, row.ownerName, row.taggedName || "", row.actorName, row.note].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filters.status && filters.status !== "all" && row.requestStatus !== filters.status) return false;
      if (filters.type && filters.type !== "all" && row.requestType !== filters.type) return false;
      if (filters.action && filters.action !== "all" && row.actionType !== filters.action) return false;
      return true;
    });
  }, [filters, query.data?.items, searchQuery, dismissedIds]);

  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const columns = [
    { key: "requestId", label: "Request", render: (row: BmidBoxAuditRow) => <span className="font-mono text-[10px] text-primary">{row.requestId}</span> },
    { key: "ownerName", label: "Submitted By", render: (row: BmidBoxAuditRow) => <span className="font-bold text-main">{row.ownerName}</span> },
    { key: "actorName", label: "Actor", render: (row: BmidBoxAuditRow) => <span className="font-medium text-main">{row.actorName}</span> },
    { key: "taggedName", label: "Tagged", render: (row: BmidBoxAuditRow) => <span className="text-main">{row.taggedName || "None"}</span> },
    { key: "status", label: "Status", render: (row: BmidBoxAuditRow) => <StatusBadge status={row.requestStatus} /> },
    { key: "actionType", label: "Action", render: (row: BmidBoxAuditRow) => <StatusBadge status={row.actionType} size="xs" /> },
    { key: "note", label: "Note", render: (row: BmidBoxAuditRow) => <span className="text-sm text-main">{row.note}</span> },
    { key: "createdAt", label: "Time", render: (row: BmidBoxAuditRow) => <span className="text-xs text-muted">{formatDateTime(row.createdAt)}</span> },
    {
      key: "actions",
      label: "",
      render: (row: BmidBoxAuditRow) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete([row.id]);
          }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/10 border border-transparent hover:border-[#ef4444]/20 transition-colors"
          title="Hide entry"
          aria-label="Hide entry"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="card p-6 space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setPendingDelete(selectedIds)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#ef4444]/15 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hide {selectedIds.length}
          </button>
        </div>
      )}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search request, owner, tagged user, reviewer, or reason..."
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "pending_admin_review", label: "Admin Review" },
              { value: "pending_tagged_user", label: "Tagged User" },
              { value: "pending_voting", label: "Voting" },
              { value: "approved", label: "Approved" },
              { value: "refused", label: "Refused" },
              { value: "removed", label: "Removed" },
            ],
          },
          {
            key: "type",
            label: "Type",
            options: [
              { value: "own", label: "Own" },
              { value: "duality", label: "Duality" },
            ],
          },
          {
            key: "action",
            label: "Action",
            options: [
              { value: "submitted", label: "Submitted" },
              { value: "reviewed", label: "Reviewed" },
              { value: "status_changed", label: "Status Changed" },
              { value: "finalized", label: "Finalized" },
              { value: "removed", label: "Removed" },
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

      <DataTable
        columns={columns}
        data={rows}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
        getId={(row) => row.id}
        selectedItems={selectedIds}
        onToggleItem={(id) =>
          setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onSelectAll={(ids) => setSelectedIds(ids)}
        emptyMessage="No audit rows"
        emptyDescription="Important Box actions will be recorded here"
        loading={query.isLoading}
      />

      <ConfirmModal
        open={Boolean(pendingDelete && pendingDelete.length > 0)}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Hide ${pendingDelete.length} audit entries?`
            : "Hide audit entry?"
        }
        message={
          pendingDelete && pendingDelete.length > 1 ? (
            <>
              <strong>{pendingDelete.length}</strong> audit entries will be hidden from view. Underlying Box data is unaffected.
            </>
          ) : (
            <>This hides the selected audit entry from the current view. The underlying Box data is unaffected.</>
          )
        }
        confirmLabel="Hide"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) dismissRows(pendingDelete);
        }}
      />
    </div>
  );
}
