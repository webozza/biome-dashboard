"use client";

import { useMemo, useState } from "react";
import { ThumbsUp, Minus, ThumbsDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ContentDoc, ListResponse } from "./types";
import { formatDate, readJson } from "./shared";

function finalResult(r: ContentDoc) {
  if (r.votingOutcome) return r.votingOutcome;
  const a = r.voteAccept || 0;
  const i = r.voteIgnore || 0;
  const ref = r.voteRefuse || 0;
  const max = Math.max(a, i, ref);
  if (max === 0) return "Pending";
  if (max === a) return "Accept leading";
  if (max === ref) return "Refuse leading";
  return "Ignore leading";
}

export function VotingTab() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const query = useQuery({
    queryKey: ["content", "voting"],
    queryFn: async () => {
      const resp = await fetch(`/api/content?limit=200`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<ListResponse>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (query.data?.items || [])
      .filter((r) => Boolean(r.votingStatus))
      .filter((r) => {
        const haystack = [r.id, r.userName, r.postTitle, r.taggedUserName || "", r.bmidNumber]
          .join(" ")
          .toLowerCase();
        if (q && !haystack.includes(q)) return false;
        if (filters.votingStatus && filters.votingStatus !== "all" && r.votingStatus !== filters.votingStatus) return false;
        if (filters.type && filters.type !== "all" && r.type !== filters.type) return false;
        return true;
      });
  }, [filters, query.data?.items, searchQuery]);

  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const stats = useMemo(() => {
    return {
      open: filtered.filter((r) => r.votingStatus === "open").length,
      closed: filtered.filter((r) => r.votingStatus === "closed").length,
      finalized: filtered.filter((r) => r.votingStatus === "finalized").length,
      accepts: filtered.reduce((sum, r) => sum + (r.voteAccept || 0), 0),
      refuses: filtered.reduce((sum, r) => sum + (r.voteRefuse || 0), 0),
    };
  }, [filtered]);

  const columns = [
    {
      key: "id",
      label: "Request",
      render: (r: ContentDoc) => <span className="font-mono text-[10px] font-bold text-primary">{r.id.slice(0, 10)}</span>,
    },
    {
      key: "postTitle",
      label: "Content",
      render: (r: ContentDoc) => (
        <div>
          <p className="font-bold text-main">{r.postTitle}</p>
          <p className="text-xs text-muted truncate max-w-[280px]">{r.postPreview}</p>
        </div>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      render: (r: ContentDoc) => (
        <div>
          <p className="font-bold text-main">{r.userName}</p>
          <p className="text-[10px] text-muted">{r.bmidNumber || "No BMID"}</p>
        </div>
      ),
    },
    {
      key: "tagged",
      label: "Tagged",
      render: (r: ContentDoc) => (
        <span className="text-main font-medium">{r.taggedUserName || "Same as owner"}</span>
      ),
    },
    {
      key: "votingStatus",
      label: "Voting",
      render: (r: ContentDoc) => <StatusBadge status={r.votingStatus || "open"} />,
    },
    {
      key: "votes",
      label: "A / I / R",
      render: (r: ContentDoc) => (
        <div className="flex gap-3 text-[10px] font-black uppercase tracking-wider">
          <span className="text-emerald-400 flex items-center gap-0.5">
            <ThumbsUp className="w-3 h-3" />
            {r.voteAccept || 0}
          </span>
          <span className="text-amber-400 flex items-center gap-0.5">
            <Minus className="w-3 h-3" />
            {r.voteIgnore || 0}
          </span>
          <span className="text-red-400 flex items-center gap-0.5">
            <ThumbsDown className="w-3 h-3" />
            {r.voteRefuse || 0}
          </span>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Submitted",
      render: (r: ContentDoc) => <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>,
    },
    {
      key: "result",
      label: "Result",
      render: (r: ContentDoc) => <span className="text-sm font-bold text-main capitalize">{finalResult(r)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-5">
        {[
          { label: "Open", value: stats.open },
          { label: "Closed", value: stats.closed },
          { label: "Finalized", value: stats.finalized },
          { label: "Accepts", value: stats.accepts },
          { label: "Refuses", value: stats.refuses },
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
          searchPlaceholder="Search request, owner, title, or BMID..."
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
          getId={(r) => r.id}
          emptyMessage="No voting sessions"
          emptyDescription="Admin approval of a content request opens voting."
          loading={query.isLoading}
        />
      </div>
    </div>
  );
}
