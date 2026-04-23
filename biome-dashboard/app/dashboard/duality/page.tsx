"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { readJson } from "@/lib/http";
import { formatDate } from "@/lib/format";
import { AuthGate } from "@/components/ui/auth-gate";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type DualityDoc = {
  id: string;
  ownerId: string;
  ownerName: string;
  taggedUserId: string;
  taggedUserName: string;
  taggedUserAction: "pending" | "accepted" | "declined";
  status: "pending" | "approved" | "rejected" | "waiting_tagged" | "cancelled";
  source: "content" | "box";
  decisionHistory: { action: string; by: string; at: string }[];
  timeline: { event: string; at: string }[];
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string | null;
  adminNote?: string | null;
};

type ListResponse = { items: DualityDoc[]; nextCursor: string | null };

const NEUTRAL_FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-main outline-none transition-colors focus:border-white/20";

export default function DualityPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
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
  const [adminNote, setAdminNote] = useState("");
  const [pageCursors, setPageCursors] = useState<Record<number, string | undefined>>({ 1: undefined });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const deferredSearch = useDeferredValue(searchQuery);

  const statusFilter = activeFilters.status && activeFilters.status !== "all" ? activeFilters.status : undefined;
  const sourceFilter = activeFilters.source && activeFilters.source !== "all" ? activeFilters.source : undefined;
  const currentCursor = currentPage > 1 ? pageCursors[currentPage] : undefined;

  const listQuery = useQuery({
    queryKey: ["duality", "list", { statusFilter, sourceFilter, currentCursor, itemsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(itemsPerPage) });
      if (currentCursor) params.set("cursor", currentCursor);
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      const resp = await fetch(`/api/duality?${params}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<ListResponse>(resp);
    },
    enabled: Boolean(apiToken) && (currentPage === 1 || Boolean(currentCursor)),
    placeholderData: (prev) => prev,
  });

  const visibleRows = useMemo(() => {
    const items = listQuery.data?.items || [];
    if (!deferredSearch) return items;
    const q = deferredSearch.toLowerCase();
    return items.filter(
      (r) =>
        r.ownerName?.toLowerCase().includes(q) ||
        r.taggedUserName?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [deferredSearch, listQuery.data?.items]);

  const selected = useMemo(
    () => visibleRows.find((r) => r.id === selectedId) || listQuery.data?.items.find((r) => r.id === selectedId) || null,
    [visibleRows, selectedId, listQuery.data?.items]
  );

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const resp = await fetch(`/api/duality/${id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      return readJson<DualityDoc>(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duality", "list"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(`/api/duality/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ id: string; deleted: true }>(resp);
    },
    onSuccess: (_, deletedId) => {
      setSelectedId((cur) => (cur === deletedId ? null : cur));
      queryClient.invalidateQueries({ queryKey: ["duality", "list"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map(async (id) => {
          const resp = await fetch(`/api/duality/${id}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${apiToken}` },
          });
          return readJson<{ id: string; deleted: true }>(resp);
        })
      );
      return { count: ids.length };
    },
    onSuccess: (_, ids) => {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      setSelectedId((cur) => (cur && ids.includes(cur) ? null : cur));
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["duality", "list"] });
    },
  });

  const isMutating = patchMutation.isPending || deleteMutation.isPending;

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

  function resetPagination() {
    setSelectedId(null);
    setPageCursors({ 1: undefined });
    setPage(1);
  }

  async function handleStatusUpdate(id: string, status: string) {
    const existing = selected;
    const now = new Date().toISOString().split("T")[0];
    const reviewerName = user?.name || user?.email || "Admin";
    const patch: Record<string, unknown> = {
      status,
      reviewedBy: reviewerName,
    };
    if (adminNote.trim()) {
      patch.adminNote = adminNote.trim();
    }
    // Append to decisionHistory and timeline
    const decisionHistory = [...(existing?.decisionHistory || [])];
    const timeline = [...(existing?.timeline || [])];
    decisionHistory.push({
      action: status === "approved" ? "Approved" : "Rejected",
      by: reviewerName,
      at: now,
    });
    timeline.push({
      event: status === "approved" ? "Admin approved" : "Admin rejected",
      at: now,
    });
    patch.decisionHistory = decisionHistory;
    patch.timeline = timeline;

    await patchMutation.mutateAsync({ id, patch });
  }

  const columns = [
    {
      key: "ownerName",
      label: "Registry Owner",
      render: (r: DualityDoc) => <span className="font-bold text-main">{r.ownerName}</span>,
    },
    {
      key: "taggedUserName",
      label: "Joint User",
      render: (r: DualityDoc) => (
        <div>
          <p className="font-bold text-main">{r.taggedUserName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted font-bold uppercase tracking-tight">Status:</span>
            <StatusBadge status={r.taggedUserAction} size="xs" />
          </div>
        </div>
      ),
    },
    {
      key: "source",
      label: "Origin",
      render: (r: DualityDoc) => (
        <span className="uppercase text-[10px] font-bold text-muted bg-surface-hover px-2 py-0.5 rounded shadow-sm">
          {r.source}
        </span>
      ),
    },
    {
      key: "status",
      label: "State",
      render: (r: DualityDoc) => <StatusBadge status={r.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (r: DualityDoc) => <span className="text-muted text-xs font-medium">{formatDate(r.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (r: DualityDoc) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete([r.id]);
          }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/10 border border-transparent hover:border-[#ef4444]/20 transition-colors"
          title="Delete request"
          aria-label="Delete request"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (!apiToken) {
    return <AuthGate icon={GitBranch} title="Duality Requests" subtitle="Sign in to manage duality requests" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Duality Requests</h1>
            <p className="text-sm text-muted font-medium italic">Monitor joint asset ownership and tagging requests</p>
          </div>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={() => setPendingDelete(selectedIds)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#ef4444]/15 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {selectedIds.length}
          </button>
        )}
      </div>

      <div className="card">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search owners or tagged identities..."
            filters={[
              {
                key: "status",
                label: "Status",
                options: [
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                  { value: "waiting_tagged", label: "Waiting Tagged" },
                  { value: "cancelled", label: "Cancelled" },
                ],
              },
              {
                key: "source",
                label: "Source",
                options: [
                  { value: "content", label: "Content" },
                  { value: "box", label: "Box" },
                ],
              },
            ]}
            activeFilters={activeFilters}
            onFilterChange={(key, value) => {
              resetPagination();
              setFilter(key, value);
            }}
            onClearFilters={() => {
              resetPagination();
              clearFilters();
            }}
          />
        </div>

        {listQuery.isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 mb-4">
            Failed to load duality requests: {listQuery.error.message}
          </div>
        )}

        <div className="relative">
          {listQuery.isFetching && (
            <div className="absolute right-3 top-[-10px] z-10 flex items-center gap-2 rounded-full border border-white/10 bg-surface/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing
            </div>
          )}
          <DataTable
            columns={columns}
            data={visibleRows}
            currentPage={currentPage}
            totalPages={Math.max(currentPage, 1)}
            totalItems={visibleRows.length}
            pageSize={itemsPerPage}
            hasNextPage={Boolean(listQuery.data?.nextCursor)}
            onPageChange={handlePageChange}
            getId={(r) => r.id}
            selectedItems={selectedIds}
            onToggleItem={(id) =>
              setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            onSelectAll={(ids) => setSelectedIds(ids)}
            onRowClick={(r) => {
              setSelectedId(r.id);
              setAdminNote(r.adminNote || "");
            }}
            emptyDescription="Change filters or search within the current result page."
            loading={listQuery.isLoading}
          />
        </div>
      </div>

      <DetailDrawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={`Duality Case: ${selected?.id ? selected.id.slice(0, 8) + "..." : ""}`}
      >
        {!selected ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Primary Owner</p>
                <p className="font-bold text-main">{selected.ownerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Associated Peer</p>
                <p className="font-bold text-main">{selected.taggedUserName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Peer Engagement</p>
                <StatusBadge status={selected.taggedUserAction} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Asset Source</p>
                <p className="text-sm font-bold text-primary uppercase">{selected.source}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Current State</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Initiated</p>
                <p className="text-sm font-medium">{formatDate(selected.createdAt)}</p>
              </div>
            </div>

            {/* Decision History */}
            {selected.decisionHistory && selected.decisionHistory.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">
                  Administrative Actions
                </h3>
                {selected.decisionHistory.map((d, i) => (
                  <div key={i} className="p-3 bg-background border border-border rounded-xl">
                    <p className="text-sm font-bold text-main">{d.action}</p>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {d.by.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wide">
                        {d.by} <span className="mx-1 opacity-30">&bull;</span> {d.at}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline */}
            {selected.timeline && selected.timeline.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">
                  Event Timeline
                </h3>
                <div className="space-y-0 relative ml-4">
                  <div className="absolute left-[-16px] top-2 bottom-2 w-0.5 bg-border" />
                  {selected.timeline.map((t, i) => (
                    <div key={i} className="flex items-start gap-4 py-3 relative">
                      <div className="absolute left-[-20px] top-[14px] w-2.5 h-2.5 rounded-full bg-white border-2 border-primary z-10 shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-main">{t.event}</p>
                        <p className="text-[10px] text-muted font-medium mt-0.5">{t.at}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin note */}
            <div className="space-y-2">
              <label className="block text-xs text-tertiary">Admin Note</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                disabled={isMutating}
                className={NEUTRAL_FIELD_CLASS}
                placeholder="Add reviewer context for this request"
              />
            </div>

            {(patchMutation.isError || deleteMutation.isError) && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {patchMutation.error?.message || deleteMutation.error?.message}
              </div>
            )}

            {/* Action buttons */}
            {(selected.status === "pending" || selected.status === "waiting_tagged") && (
              <div className="flex gap-2">
                <button
                  onClick={() => void handleStatusUpdate(selected.id, "approved")}
                  disabled={isMutating}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent/10 text-accent border border-accent/20 rounded-xl text-sm hover:bg-accent/20 transition-colors disabled:opacity-60"
                >
                  {patchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Grant Approval
                </button>
                <button
                  onClick={() => void handleStatusUpdate(selected.id, "rejected")}
                  disabled={isMutating}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm hover:bg-red-500/20 transition-colors disabled:opacity-60"
                >
                  {patchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Decline Registry
                </button>
              </div>
            )}

            <button
              onClick={() => void deleteMutation.mutateAsync(selected.id)}
              disabled={isMutating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/5 text-red-300 border border-red-500/15 rounded-xl text-sm hover:bg-red-500/10 transition-colors disabled:opacity-60"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete Request
            </button>
          </div>
        )}
      </DetailDrawer>

      <ConfirmModal
        open={Boolean(pendingDelete && pendingDelete.length > 0)}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} duality requests?`
            : "Delete duality request?"
        }
        message={
          pendingDelete && pendingDelete.length > 1 ? (
            <>
              This permanently removes <strong>{pendingDelete.length}</strong> selected duality requests.
              This cannot be undone.
            </>
          ) : (
            <>This permanently removes the selected duality request. This cannot be undone.</>
          )
        }
        confirmLabel="Delete"
        tone="danger"
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) void bulkDeleteMutation.mutateAsync(pendingDelete);
        }}
        onCancel={() => {
          if (!bulkDeleteMutation.isPending) setPendingDelete(null);
        }}
      />
    </div>
  );
}
