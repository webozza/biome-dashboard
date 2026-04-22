"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { CheckCircle, CheckCircle2, Eye, Loader2, MinusCircle, Vote, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VotingItem } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { MetricCard } from "@/components/ui/metric-card";
import { useAuthStore } from "@/lib/stores/auth-store";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { readJson } from "@/lib/http";
import { formatDate } from "@/lib/format";
import { AuthGate } from "@/components/ui/auth-gate";

type VotingListResponse = {
  items: VotingItem[];
  nextCursor: string | null;
};

function getLiveOutcome(item: VotingItem): VotingItem["outcome"] {
  if (item.outcome) return item.outcome;
  const counts = [
    { outcome: "accepted" as const, value: item.accept },
    { outcome: "ignored" as const, value: item.ignore },
    { outcome: "refused" as const, value: item.refuse },
  ];
  const max = Math.max(...counts.map((entry) => entry.value));
  if (max <= 0) return null;
  const leaders = counts.filter((entry) => entry.value === max);
  return leaders.length === 1 ? leaders[0].outcome : null;
}

function matchesSearch(item: VotingItem, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [item.id, item.title, item.requestId, item.requestType, item.outcome || ""].some((value) =>
    value.toLowerCase().includes(q)
  );
}

function exportRows(rows: VotingItem[]) {
  if (rows.length === 0) return;

  const headers = [
    "id",
    "requestId",
    "requestType",
    "title",
    "accept",
    "ignore",
    "refuse",
    "status",
    "outcome",
    "openedAt",
    "closedAt",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((key) => {
          const value = String(row[key as keyof VotingItem] ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `voting-sessions-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function VotingPage() {
  const queryClient = useQueryClient();
  const apiToken = useAuthStore((s) => s.apiToken);
  const {
    searchQuery,
    setSearchQuery,
    activeFilters,
    setFilter,
    clearFilters,
    currentPage,
    setPage,
    itemsPerPage,
  } = useDashboardStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVoter, setSelectedVoter] = useState<UserPickerOption | null>(null);
  const [quickVoteId, setQuickVoteId] = useState<string | null>(null);
  const [quickVoter, setQuickVoter] = useState<UserPickerOption | null>(null);
  const [pageCursors, setPageCursors] = useState<Record<number, string | undefined>>({ 1: undefined });
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const statusFilter = activeFilters.status && activeFilters.status !== "all" ? activeFilters.status : undefined;
  const typeFilter = activeFilters.type && activeFilters.type !== "all" ? activeFilters.type : undefined;
  const currentCursor = currentPage > 1 ? pageCursors[currentPage] : undefined;

  const listQuery = useQuery({
    queryKey: ["voting", "list", { statusFilter, typeFilter, currentCursor, itemsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(itemsPerPage) });
      if (currentCursor) params.set("cursor", currentCursor);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("requestType", typeFilter);

      const resp = await fetch(`/api/voting?${params.toString()}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<VotingListResponse>(resp);
    },
    enabled: Boolean(apiToken) && (currentPage === 1 || Boolean(currentCursor)),
    placeholderData: (previousData) => previousData,
  });

  const openSessionsQuery = useQuery({
    queryKey: ["voting", "open-sessions"],
    queryFn: async () => {
      const resp = await fetch("/api/voting?status=open&limit=100", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ items: VotingItem[] }>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const openSessions = openSessionsQuery.data?.items || [];
  const quickSelected = useMemo(
    () => openSessions.find((item) => item.id === quickVoteId) || null,
    [openSessions, quickVoteId]
  );

  const visibleRows = useMemo(
    () => (listQuery.data?.items || []).filter((item) => matchesSearch(item, deferredSearchQuery)),
    [deferredSearchQuery, listQuery.data?.items]
  );

  const selected = useMemo(
    () => visibleRows.find((item) => item.id === selectedId) || listQuery.data?.items.find((item) => item.id === selectedId) || null,
    [listQuery.data?.items, selectedId, visibleRows]
  );

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VotingItem> }) => {
      const resp = await fetch(`/api/voting/${id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      return readJson<VotingItem>(resp);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["voting", "detail", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["voting", "list"] });
      queryClient.invalidateQueries({ queryKey: ["voting", "open-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["content"] });
      queryClient.invalidateQueries({ queryKey: ["bmid-box"] });
    },
  });

  const recordVoteMutation = useMutation({
    mutationFn: async ({
      id,
      actor,
      decision,
    }: {
      id: string;
      actor: UserPickerOption;
      decision: "accept" | "ignore" | "refuse";
    }) => {
      const resp = await fetch(`/api/voting/${id}/record`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actorUserId: actor.id,
          actorEmail: actor.email,
          decision,
        }),
      });
      return readJson<VotingItem>(resp);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["voting", "detail", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["voting", "list"] });
      queryClient.invalidateQueries({ queryKey: ["voting", "open-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["content"] });
      queryClient.invalidateQueries({ queryKey: ["bmid-box"] });
    },
  });

  const stats = useMemo(() => {
    const rows = listQuery.data?.items || [];
    return [
      {
        label: "Accept Votes",
        value: rows.reduce((sum, row) => sum + row.accept, 0),
        icon: CheckCircle,
        trend: { value: "API", isUp: true },
        color: "var(--primary)",
      },
      {
        label: "Ignore Votes",
        value: rows.reduce((sum, row) => sum + row.ignore, 0),
        icon: Eye,
        trend: { value: "API", isUp: true },
        color: "#f59e0b",
      },
      {
        label: "Refuse Votes",
        value: rows.reduce((sum, row) => sum + row.refuse, 0),
        icon: XCircle,
        trend: { value: "API", isUp: true },
        color: "#ef4444",
      },
      {
        label: "Active Sessions",
        value: rows.filter((row) => row.status === "open").length,
        icon: Vote,
        trend: { value: listQuery.isFetching ? "SYNC" : "LIVE", isUp: true },
        color: "#3b82f6",
      },
    ];
  }, [listQuery.data?.items, listQuery.isFetching]);

  const columns = [
    {
      key: "id",
      label: "ID",
      render: (row: VotingItem) => <span className="font-mono text-[10px] text-muted">{row.id}</span>,
    },
    {
      key: "title",
      label: "Title",
      render: (row: VotingItem) => <span className="text-main font-medium">{row.title}</span>,
    },
    {
      key: "requestType",
      label: "Type",
      render: (row: VotingItem) => (
        <span className="uppercase text-[10px] font-bold text-muted bg-surface-hover px-2 py-0.5 rounded">
          {row.requestType}
        </span>
      ),
    },
    {
      key: "votes",
      label: "Tallies",
      render: (row: VotingItem) => (
        <div className="flex items-center gap-4 text-[10px] font-bold">
          <span className="text-primary">{row.accept} ACCEPT</span>
          <span className="text-amber-500">{row.ignore} IGNORE</span>
          <span className="text-red-500">{row.refuse} REFUSE</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: VotingItem) => <StatusBadge status={row.status} />,
    },
    {
      key: "outcome",
      label: "Outcome",
      render: (row: VotingItem) => {
        const liveOutcome = getLiveOutcome(row);
        return liveOutcome ? (
          <StatusBadge status={liveOutcome} />
        ) : (
          <span className="text-xs text-muted font-medium italic">Pending...</span>
        );
      },
    },
  ];

  function resetPagination() {
    setSelectedId(null);
    setPageCursors({ 1: undefined });
    setPage(1);
  }

  function handleFilterChange(key: string, value: string) {
    resetPagination();
    setFilter(key, value);
  }

  function handleClearFilters() {
    resetPagination();
    clearFilters();
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === currentPage) return;
    if (nextPage === currentPage + 1) {
      if (!listQuery.data?.nextCursor) return;
      setPageCursors((prev) =>
        prev[nextPage] ? prev : { ...prev, [nextPage]: listQuery.data?.nextCursor || undefined }
      );
      setPage(nextPage);
      return;
    }
    if (nextPage > 1 && !pageCursors[nextPage]) return;
    setPage(nextPage);
  }

  if (!apiToken) {
    return <AuthGate icon={Vote} title="Voting Monitor" subtitle="Decision making and consensus oversight" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <Vote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Voting Monitor</h1>
            <p className="text-sm text-muted font-medium italic">Decision making and consensus oversight</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <MetricCard
            key={stat.label}
            title={stat.label}
            value={stat.value.toString()}
            trend={stat.trend}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-main">Open Sessions</h2>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              {openSessions.length} active
            </span>
          </div>
          {openSessionsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading voting sessions...
            </div>
          ) : openSessions.length ? (
            <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
              {openSessions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setQuickVoteId(item.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    quickVoteId === item.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-surface hover:border-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-main truncate">{item.title}</p>
                      <p className="mt-1 text-xs text-muted font-mono truncate">{item.requestId}</p>
                    </div>
                    <StatusBadge status={item.status} size="xs" />
                  </div>
                  <div className="mt-3 flex gap-4 text-xs font-bold">
                    <span className="text-emerald-400">A {item.accept}</span>
                    <span className="text-amber-400">I {item.ignore}</span>
                    <span className="text-red-400">R {item.refuse}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No open voting sessions right now.</p>
          )}
        </div>

        <div className="card space-y-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-main">Record Vote</h2>
          {!quickSelected ? (
            <p className="text-sm text-muted">Select an open session on the left to record a vote.</p>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm font-bold text-main">{quickSelected.title}</p>
                <p className="mt-1 text-xs text-muted font-mono">{quickSelected.id}</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-muted font-bold uppercase tracking-wider">Which user is voting?</label>
                <UserPicker
                  token={apiToken!}
                  value={quickVoter}
                  onSelect={setQuickVoter}
                  verifiedOnly
                  disabled={recordVoteMutation.isPending}
                />
                <p className="text-[11px] text-muted">Only verified users with BMID can vote.</p>
              </div>

              {recordVoteMutation.isError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                  {recordVoteMutation.error.message}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() =>
                    quickSelected && quickVoter
                      ? void recordVoteMutation.mutateAsync({
                          id: quickSelected.id,
                          actor: quickVoter,
                          decision: "accept",
                        })
                      : undefined
                  }
                  disabled={recordVoteMutation.isPending || !quickVoter}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Record Accept
                </button>
                <button
                  onClick={() =>
                    quickSelected && quickVoter
                      ? void recordVoteMutation.mutateAsync({
                          id: quickSelected.id,
                          actor: quickVoter,
                          decision: "ignore",
                        })
                      : undefined
                  }
                  disabled={recordVoteMutation.isPending || !quickVoter}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MinusCircle className="w-4 h-4" />}
                  Record Ignore
                </button>
                <button
                  onClick={() =>
                    quickSelected && quickVoter
                      ? void recordVoteMutation.mutateAsync({
                          id: quickSelected.id,
                          actor: quickVoter,
                          decision: "refuse",
                        })
                      : undefined
                  }
                  disabled={recordVoteMutation.isPending || !quickVoter}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Record Refuse
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search the current page by title, request ID, or session ID..."
            filters={[
              {
                key: "status",
                label: "Status",
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
                  { value: "content", label: "Content" },
                  { value: "box", label: "Box" },
                ],
              },
            ]}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            onExport={() => exportRows(visibleRows)}
          />
        </div>

        {listQuery.isError ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            Failed to load voting sessions: {listQuery.error.message}
          </div>
        ) : null}

        <div className="relative">
          {listQuery.isFetching ? (
            <div className="absolute right-3 top-[-10px] z-10 flex items-center gap-2 rounded-full border border-white/10 bg-surface/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing
            </div>
          ) : null}

          <DataTable
            columns={columns}
            data={visibleRows}
            currentPage={currentPage}
            totalPages={Math.max(currentPage, 1)}
            totalItems={visibleRows.length}
            pageSize={itemsPerPage}
            hasNextPage={Boolean(listQuery.data?.nextCursor)}
            onPageChange={handlePageChange}
            getId={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
            emptyDescription="Change backend filters or search within the current result page."
            loading={listQuery.isLoading}
          />
        </div>
      </div>

      <DetailDrawer open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={`Tally: ${selected?.id || ""}`}>
        {!selected ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-8 p-1">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Proposal Title</p>
                <p className="font-bold text-main">{selected.title}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Impact Area</p>
                <p className="text-sm font-bold text-primary uppercase">{selected.requestType}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Session Status</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Consensus Outcome</p>
                {getLiveOutcome(selected) ? <StatusBadge status={getLiveOutcome(selected)!} /> : <span className="text-sm font-bold text-muted italic">PENDING</span>}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Request ID</p>
                <p className="text-sm font-medium font-mono">{selected.requestId}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Opened</p>
                <p className="text-sm font-medium">{formatDate(selected.openedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Concluded</p>
                <p className="text-sm font-medium">{formatDate(selected.closedAt, "Active session")}</p>
              </div>
            </div>

            <div className="space-y-5 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">Vote Distribution</h3>
              <div className="space-y-5">
                {[
                  { label: "Accept", value: selected.accept, color: "var(--primary)" },
                  { label: "Ignore", value: selected.ignore, color: "#f59e0b" },
                  { label: "Refuse", value: selected.refuse, color: "#ef4444" },
                ].map((vote) => {
                  const total = selected.accept + selected.ignore + selected.refuse;
                  const pct = total > 0 ? Math.round((vote.value / total) * 100) : 0;
                  return (
                    <div key={vote.label}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-main uppercase tracking-wide">{vote.label}</span>
                        <span className="text-xs font-extrabold text-main">
                          {vote.value} <span className="text-[10px] text-muted font-bold">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-surface-hover rounded-full overflow-hidden border border-border/50 shadow-inner">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                          style={{ width: `${pct}%`, backgroundColor: vote.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selected.status === "open" ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                  <Vote className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-primary">This voting session is currently live. Monitoring ecosystem sentiment in real-time.</p>
              </div>
            ) : null}

            {patchMutation.isError || recordVoteMutation.isError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {patchMutation.error?.message || recordVoteMutation.error?.message}
              </div>
            ) : null}

            <div className="space-y-3 pt-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Record Vote As Verified User</p>
                <UserPicker
                  token={apiToken!}
                  value={selectedVoter}
                  onSelect={setSelectedVoter}
                  verifiedOnly
                  disabled={recordVoteMutation.isPending}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    selected && selectedVoter
                      ? void recordVoteMutation.mutateAsync({ id: selected.id, actor: selectedVoter, decision: "accept" })
                      : undefined
                  }
                  disabled={!selectedVoter || selected.status !== "open" || recordVoteMutation.isPending}
                  className="py-2.5 bg-emerald-600 text-white rounded-xl text-sm hover:bg-emerald-500 transition-colors disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? "Recording..." : "Record Accept"}
                </button>
                <button
                  onClick={() =>
                    selected && selectedVoter
                      ? void recordVoteMutation.mutateAsync({ id: selected.id, actor: selectedVoter, decision: "ignore" })
                      : undefined
                  }
                  disabled={!selectedVoter || selected.status !== "open" || recordVoteMutation.isPending}
                  className="py-2.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-xl text-sm hover:bg-amber-500/20 transition-colors disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? "Recording..." : "Record Ignore"}
                </button>
                <button
                  onClick={() =>
                    selected && selectedVoter
                      ? void recordVoteMutation.mutateAsync({ id: selected.id, actor: selectedVoter, decision: "refuse" })
                      : undefined
                  }
                  disabled={!selectedVoter || selected.status !== "open" || recordVoteMutation.isPending}
                  className="py-2.5 bg-red-500/10 text-red-300 border border-red-500/20 rounded-xl text-sm hover:bg-red-500/20 transition-colors disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? "Recording..." : "Record Refuse"}
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              {selected.status === "open" ? (
                <>
                  <button
                    onClick={() => void patchMutation.mutateAsync({ id: selected.id, patch: { status: "closed" } })}
                    disabled={patchMutation.isPending}
                    className="flex-1 py-2.5 bg-white/5 text-secondary border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors disabled:opacity-60"
                  >
                    {patchMutation.isPending ? "Updating..." : "Close Voting"}
                  </button>
                  <button
                    onClick={() =>
                      void patchMutation.mutateAsync({
                        id: selected.id,
                        patch: { status: "finalized" },
                      })
                    }
                    disabled={patchMutation.isPending}
                    className="flex-1 py-2.5 bg-emerald-600 text-white border border-emerald-500/40 rounded-xl text-sm hover:bg-emerald-500 transition-colors disabled:opacity-60"
                  >
                    {patchMutation.isPending ? "Updating..." : "Finalize Outcome"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() =>
                    void patchMutation.mutateAsync({
                      id: selected.id,
                      patch: { status: "open", outcome: null, closedAt: null },
                    })
                  }
                  disabled={patchMutation.isPending}
                  className="flex-1 py-2.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-xl text-sm hover:bg-blue-500/20 transition-colors disabled:opacity-60"
                >
                  {patchMutation.isPending ? "Updating..." : "Reopen Voting"}
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
