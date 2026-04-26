"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ContentDoc, ListResponse } from "./types";
import { formatDateTime, readJson } from "./shared";

type AuditRow = {
  key: string;
  requestId: string;
  ownerName: string;
  taggedName: string | null;
  requestType: "own" | "duality";
  requestStatus: ContentDoc["status"];
  note: string;
  by: string;
  at: string;
};

export function AuditTab() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const pageSize = 12;

  const query = useQuery({
    queryKey: ["content", "audit"],
    queryFn: async () => {
      const resp = await fetch(`/api/content?limit=200`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<ListResponse>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const rows = useMemo<AuditRow[]>(() => {
    const items = query.data?.items || [];
    const flat: AuditRow[] = [];
    for (const r of items) {
      for (let i = 0; i < (r.adminNotes || []).length; i++) {
        const note = r.adminNotes[i];
        flat.push({
          key: `${r.id}-${i}`,
          requestId: r.id,
          ownerName: r.userName,
          taggedName: r.taggedUserName || null,
          requestType: r.type,
          requestStatus: r.status,
          note: note.note,
          by: note.by,
          at: note.at,
        });
      }
    }
    return flat.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [query.data?.items]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (dismissedIds.has(row.key)) return false;
      const haystack = [row.requestId, row.ownerName, row.taggedName || "", row.by, row.note].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filters.status && filters.status !== "all" && row.requestStatus !== filters.status) return false;
      if (filters.type && filters.type !== "all" && row.requestType !== filters.type) return false;
      return true;
    });
  }, [filters, rows, searchQuery, dismissedIds]);

  const dismissRows = (ids: string[]) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    setPendingDelete(null);
  };

  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const columns = [
    { key: "requestId", label: "Request", render: (row: AuditRow) => <span className="font-mono text-[10px] text-primary">{row.requestId.slice(0, 10)}</span> },
    { key: "ownerName", label: "Owner", render: (row: AuditRow) => <span className="font-bold text-main">{row.ownerName}</span> },
    { key: "by", label: "By", render: (row: AuditRow) => <span className="font-medium text-main">{row.by}</span> },
    { key: "taggedName", label: "Tagged", render: (row: AuditRow) => <span className="text-main">{row.taggedName || "None"}</span> },
    { key: "status", label: "Status", render: (row: AuditRow) => <StatusBadge status={row.requestStatus} /> },
    { key: "type", label: "Type", render: (row: AuditRow) => <StatusBadge status={row.requestType} size="xs" /> },
    { key: "note", label: "Note", render: (row: AuditRow) => <span className="text-sm text-main">{row.note}</span> },
    { key: "at", label: "Time", render: (row: AuditRow) => <span className="text-xs text-muted">{formatDateTime(row.at)}</span> },
    {
      key: "actions",
      label: "",
      render: (row: AuditRow) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete([row.key]);
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
        searchPlaceholder="Search request, owner, tagged user, reviewer, or note..."
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "pending", label: "Pending" },
              { value: "waiting_tagged", label: "Waiting Tagged" },
              { value: "in_review", label: "In Review" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "cancelled", label: "Cancelled" },
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
        data={paged}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
        getId={(row) => row.key}
        selectedItems={selectedIds}
        onToggleItem={(id) =>
          setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onSelectAll={(ids) => setSelectedIds(ids)}
        emptyMessage="No audit entries"
        emptyDescription="Admin notes from review actions will appear here."
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
              <strong>{pendingDelete.length}</strong> audit entries will be hidden from view. Underlying content data is unaffected.
            </>
          ) : (
            <>This hides the selected audit entry from the current view. The underlying content data is unaffected.</>
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
