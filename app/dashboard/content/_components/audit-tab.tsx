"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
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
      const haystack = [row.requestId, row.ownerName, row.taggedName || "", row.by, row.note].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filters.status && filters.status !== "all" && row.requestStatus !== filters.status) return false;
      if (filters.type && filters.type !== "all" && row.requestType !== filters.type) return false;
      return true;
    });
  }, [filters, rows, searchQuery]);

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
  ];

  return (
    <div className="card p-6">
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
        emptyMessage="No audit entries"
        emptyDescription="Admin notes from review actions will appear here."
        loading={query.isLoading}
      />
    </div>
  );
}
