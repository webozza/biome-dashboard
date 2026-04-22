"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthStore } from "@/lib/stores/auth-store";
import { type BmidBoxAuditRow } from "@/lib/bmid-box-client";
import { readJson } from "@/lib/http";
import { formatDateTime } from "@/lib/format";

export function AuditTab() {
  const apiToken = useAuthStore((state) => state.apiToken);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

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
      const haystack = [row.requestId, row.ownerName, row.taggedName || "", row.actorName, row.note].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filters.status && filters.status !== "all" && row.requestStatus !== filters.status) return false;
      if (filters.type && filters.type !== "all" && row.requestType !== filters.type) return false;
      if (filters.action && filters.action !== "all" && row.actionType !== filters.action) return false;
      return true;
    });
  }, [filters, query.data?.items, searchQuery]);

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
  ];

  return (
    <div className="card p-6">
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
        emptyMessage="No audit rows"
        emptyDescription="Important Box actions will be recorded here"
        loading={query.isLoading}
      />
    </div>
  );
}
