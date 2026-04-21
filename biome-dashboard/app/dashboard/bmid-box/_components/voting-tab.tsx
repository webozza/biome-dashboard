"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BmidBoxRequest } from "@/lib/data/bmid-box";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthStore } from "@/lib/stores/auth-store";
import { postBmidBoxAction } from "@/lib/bmid-box-client";
import { readJson } from "@/lib/http";
import { formatDate } from "@/lib/format";

function finalResult(request: BmidBoxRequest) {
  if (request.currentStatus === "approved") return "Approved";
  if (request.currentStatus === "refused") return "Refused";
  if (request.currentStatus === "removed") return "Removed";
  const max = Math.max(request.acceptCount, request.ignoreCount, request.refuseCount);
  if (max === 0) return "Pending";
  if (max === request.acceptCount) return "Accept leading";
  if (max === request.refuseCount) return "Refuse leading";
  return "Ignore leading";
}

export function VotingTab() {
  const apiToken = useAuthStore((state) => state.apiToken);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const query = useQuery({
    queryKey: ["bmid-box", "voting"],
    queryFn: async () => {
      const resp = await fetch("/api/bmid-box/voting", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ items: Array<BmidBoxRequest & { id: string }> }>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const actionMutation = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) =>
      postBmidBoxAction(apiToken!, path, {
        actorName: user?.name || "Admin",
        ...(body || {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bmid-box"] });
    },
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (query.data?.items || []).filter((request) => {
      const haystack = [request.id, request.ownerSnapshot?.name || "", request.taggedSnapshot?.name || "", request.previewData.title].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filters.votingStatus && filters.votingStatus !== "all" && request.votingStatus !== filters.votingStatus) return false;
      if (filters.type && filters.type !== "all" && request.type !== filters.type) return false;
      return true;
    });
  }, [filters, query.data?.items, searchQuery]);

  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const columns = [
    {
      key: "id",
      label: "Request",
      render: (request: BmidBoxRequest & { id: string }) => (
        <Link href={`/dashboard/bmid-box/requests/${request.id}`} className="font-mono text-[10px] font-bold text-primary">
          {request.id}
        </Link>
      ),
    },
    {
      key: "preview",
      label: "Item",
      render: (request: BmidBoxRequest & { id: string }) => (
        <div>
          <p className="font-bold text-main">{request.previewData.title}</p>
          <p className="text-xs text-muted">{request.previewData.caption}</p>
        </div>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      render: (request: BmidBoxRequest & { id: string }) => <span className="font-bold text-main">{request.ownerSnapshot?.name}</span>,
    },
    {
      key: "tagged",
      label: "Tagged",
      render: (request: BmidBoxRequest & { id: string }) => <span className="font-medium text-main">{request.taggedSnapshot?.name || "Same as owner"}</span>,
    },
    {
      key: "status",
      label: "Voting",
      render: (request: BmidBoxRequest & { id: string }) => <StatusBadge status={request.votingStatus || "submitted"} />,
    },
    {
      key: "votes",
      label: "A / I / R",
      render: (request: BmidBoxRequest & { id: string }) => (
        <div className="flex gap-2 text-[10px] font-black uppercase tracking-wider">
          <span className="text-emerald-400">{request.acceptCount}</span>
          <span className="text-amber-400">{request.ignoreCount}</span>
          <span className="text-red-400">{request.refuseCount}</span>
        </div>
      ),
    },
    {
      key: "start",
      label: "Start",
      render: (request: BmidBoxRequest & { id: string }) => <span className="text-xs text-muted">{formatDate(request.votingStartAt)}</span>,
    },
    {
      key: "end",
      label: "End",
      render: (request: BmidBoxRequest & { id: string }) => <span className="text-xs text-muted">{formatDate(request.votingEndAt)}</span>,
    },
    {
      key: "result",
      label: "Result",
      render: (request: BmidBoxRequest & { id: string }) => <span className="text-sm font-bold text-main">{finalResult(request)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-5">
        {[
          { label: "Open", value: filtered.filter((r) => r.votingStatus === "open").length },
          { label: "Closed", value: filtered.filter((r) => r.votingStatus === "closed").length },
          { label: "Finalized", value: filtered.filter((r) => r.votingStatus === "finalized").length },
          { label: "Accepts", value: filtered.reduce((sum, r) => sum + r.acceptCount, 0) },
          { label: "Refuses", value: filtered.reduce((sum, r) => sum + r.refuseCount, 0) },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{item.label}</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-main">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search request, owner, tagged user, or title..."
          filters={[
            {
              key: "votingStatus",
              label: "Voting",
              options: [
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
                { value: "finalized", label: "Finalized" },
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
          data={rows}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          getId={(request) => request.id}
          onRowClick={(request) => {
            window.location.href = `/dashboard/bmid-box/requests/${request.id}`;
          }}
          emptyMessage="No voting sessions"
          emptyDescription="Move a request to voting stage to see it here"
          loading={query.isLoading}
        />
      </div>

      <div className="card p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Quick Admin Actions</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              const id = window.prompt("Request ID to open voting");
              if (!id) return;
              actionMutation.mutate({ path: `/api/bmid-box/requests/${id}/voting-stage` });
            }}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-main transition hover:border-primary/30 hover:text-primary"
          >
            Open voting
          </button>
          <button
            onClick={() => {
              const id = window.prompt("Request ID to close voting");
              if (!id) return;
              actionMutation.mutate({ path: `/api/bmid-box/voting/${id}/close` });
            }}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-main transition hover:border-primary/30 hover:text-primary"
          >
            Close voting
          </button>
          <button
            onClick={() => {
              const id = window.prompt("Request ID to finalize");
              if (!id) return;
              const result = window.prompt("Result: approved, refused, or cancelled", "approved");
              if (result === null) return;
              actionMutation.mutate({
                path: `/api/bmid-box/voting/${id}/finalize`,
                body: {
                  result: result === "refused" ? "refused" : result === "cancelled" ? "cancelled" : "approved",
                },
              });
            }}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-main transition hover:border-primary/30 hover:text-primary"
          >
            Finalize
          </button>
        </div>
      </div>
    </div>
  );
}
