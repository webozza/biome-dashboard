"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  ShieldCheck,
  Vote,
  Eye,
  GitBranch,
  Trash2,
  ThumbsUp,
  Minus,
  ThumbsDown,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ContentDoc, ListResponse, UserPostOption } from "./types";
import { formatDate, readJson } from "./shared";

const NEUTRAL_FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-main outline-none transition-colors focus:border-white/20";

export function RequestsTab() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const apiToken = useAuthStore((s) => s.apiToken);
  const {
    searchQuery,
    setSearchQuery,
    activeFilters,
    setFilter,
    clearFilters,
    selectedItems,
    toggleItem,
    selectAll,
    clearSelection,
    currentPage,
    setPage,
    itemsPerPage,
  } = useDashboardStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [pageCursors, setPageCursors] = useState<Record<number, string | undefined>>({ 1: undefined });
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    postTitle: "",
    postPreview: "",
    postImageUrl: "",
    type: "own" as "own" | "duality",
    postId: "",
  });
  const [selectedUserOption, setSelectedUserOption] = useState<UserPickerOption | null>(null);
  const [taggedUserOption, setTaggedUserOption] = useState<UserPickerOption | null>(null);
  const deferredSearch = useDeferredValue(searchQuery);

  const userPostsQuery = useQuery({
    queryKey: ["users", "posts", selectedUserOption?.id],
    queryFn: async () => {
      const resp = await fetch(`/api/users/${selectedUserOption!.id}/posts?limit=100`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ items: UserPostOption[] }>(resp);
    },
    enabled: Boolean(apiToken && selectedUserOption?.id),
    staleTime: 60 * 1000,
  });

  const statusFilter = activeFilters.status && activeFilters.status !== "all" ? activeFilters.status : undefined;
  const typeFilter = activeFilters.type && activeFilters.type !== "all" ? activeFilters.type : undefined;
  const currentCursor = currentPage > 1 ? pageCursors[currentPage] : undefined;

  const listQuery = useQuery({
    queryKey: ["content", "list", { statusFilter, typeFilter, currentCursor, itemsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(itemsPerPage) });
      if (currentCursor) params.set("cursor", currentCursor);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const resp = await fetch(`/api/content?${params}`, {
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
        r.userName?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.postTitle?.toLowerCase().includes(q) ||
        r.bmidNumber?.toLowerCase().includes(q)
    );
  }, [deferredSearch, listQuery.data?.items]);

  const selected = useMemo(
    () => visibleRows.find((r) => r.id === selectedId) || listQuery.data?.items.find((r) => r.id === selectedId) || null,
    [visibleRows, selectedId, listQuery.data?.items]
  );

  const allItems = listQuery.data?.items || [];
  const stats = useMemo(() => {
    const totalAccept = allItems.reduce((s, v) => s + (v.voteAccept || 0), 0);
    const totalIgnore = allItems.reduce((s, v) => s + (v.voteIgnore || 0), 0);
    const totalRefuse = allItems.reduce((s, v) => s + (v.voteRefuse || 0), 0);
    const pendingCount = allItems.filter((r) => r.status === "pending" || r.status === "in_review").length;
    return { totalAccept, totalIgnore, totalRefuse, pendingCount };
  }, [allItems]);

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const resp = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      return readJson<ContentDoc>(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(`/api/content/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ id: string; deleted: true }>(resp);
    },
    onSuccess: (_, deletedId) => {
      clearSelection();
      setSelectedId((cur) => (cur === deletedId ? null : cur));
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const resp = await fetch(`/api/content`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJson<{ id: string }>(resp);
    },
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm({ postTitle: "", postPreview: "", postImageUrl: "", type: "own", postId: "" });
      setSelectedUserOption(null);
      setTaggedUserOption(null);
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Record<string, unknown> }) =>
      Promise.all(
        ids.map((id) =>
          fetch(`/api/content/${id}`, {
            method: "PATCH",
            headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
            body: JSON.stringify(patch),
          }).then((r) => readJson<ContentDoc>(r))
        )
      ),
    onSuccess: () => {
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      Promise.all(
        ids.map((id) =>
          fetch(`/api/content/${id}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${apiToken}` },
          }).then((r) => readJson<{ id: string; deleted: true }>(r))
        )
      ),
    onSuccess: () => {
      clearSelection();
      setSelectedId(null);
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
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
    clearSelection();
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

  async function handleStatusUpdate(id: string, status: string) {
    const patch: Record<string, unknown> = {
      status,
      reviewedBy: user?.name || user?.email || "Admin",
    };
    if (adminNote.trim()) {
      const existing = selected?.adminNotes || [];
      patch.adminNotes = [
        ...existing,
        { note: adminNote.trim(), by: user?.name || "Admin", at: new Date().toISOString().split("T")[0] },
      ];
    }
    if (status === "rejected") {
      patch.rejectionReason = adminNote.trim() || "Rejected by admin";
    }
    await patchMutation.mutateAsync({ id, patch });
  }

  async function handleCreateSubmit() {
    if (!selectedUserOption || !createForm.postTitle.trim() || !createForm.postPreview.trim()) return;
    const payload: Record<string, unknown> = {
      userId: selectedUserOption.id,
      userName: selectedUserOption.displayName,
      bmidNumber: "",
      postTitle: createForm.postTitle.trim(),
      postPreview: createForm.postPreview.trim(),
      postImageUrl: createForm.postImageUrl.trim() || null,
      postId: createForm.postId.trim() || null,
      type: createForm.type,
      status: "pending",
      adminNotes: [],
      reviewedBy: null,
      rejectionReason: null,
      voteAccept: 0,
      voteIgnore: 0,
      voteRefuse: 0,
      votingStatus: null,
      votingOutcome: null,
    };
    if (createForm.type === "duality" && taggedUserOption) {
      payload.taggedUserId = taggedUserOption.id;
      payload.taggedUserName = taggedUserOption.displayName;
      payload.taggedUserAction = "pending";
    }
    await createMutation.mutateAsync(payload);
  }

  function handleOwnerSelect(userOption: UserPickerOption) {
    setSelectedUserOption(userOption);
    setCreateForm((current) => ({
      ...current,
      postId: "",
      postTitle: "",
      postPreview: "",
      postImageUrl: "",
    }));
  }

  function handlePostSelect(postId: string) {
    const selectedPost = (userPostsQuery.data?.items || []).find((item) => item.id === postId);
    setCreateForm((current) => ({
      ...current,
      postId,
      postTitle: selectedPost?.title || "",
      postPreview: selectedPost?.description || "",
      postImageUrl: selectedPost?.imageUrl || "",
    }));
  }

  const columns = [
    {
      key: "id",
      label: "Request",
      render: (r: ContentDoc) => (
        <span className="font-mono text-[10px] text-primary font-bold">{r.id}</span>
      ),
    },
    {
      key: "userName",
      label: "User",
      render: (r: ContentDoc) => (
        <div>
          <p className="font-bold text-main">{r.userName}</p>
          <p className="text-[10px] text-muted font-medium">{r.bmidNumber || "No BMID"}</p>
        </div>
      ),
    },
    {
      key: "postTitle",
      label: "Post Title",
      render: (r: ContentDoc) => <span className="text-main font-medium">{r.postTitle}</span>,
    },
    {
      key: "type",
      label: "Type",
      render: (r: ContentDoc) => (
        <span
          className={`inline-flex items-center gap-1 uppercase text-[10px] font-bold px-2 py-0.5 rounded ${
            r.type === "duality"
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
              : "bg-surface-hover text-muted"
          }`}
        >
          {r.type === "duality" && <GitBranch className="w-3 h-3" />}
          {r.type}
        </span>
      ),
    },
    {
      key: "votes",
      label: "Votes",
      render: (r: ContentDoc) => {
        const a = r.voteAccept || 0;
        const i = r.voteIgnore || 0;
        const ref = r.voteRefuse || 0;
        if (a === 0 && i === 0 && ref === 0) return <span className="text-xs text-muted">—</span>;
        return (
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="text-emerald-400 flex items-center gap-0.5">
              <ThumbsUp className="w-3 h-3" /> {a}
            </span>
            <span className="text-amber-400 flex items-center gap-0.5">
              <Minus className="w-3 h-3" /> {i}
            </span>
            <span className="text-red-400 flex items-center gap-0.5">
              <ThumbsDown className="w-3 h-3" /> {ref}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r: ContentDoc) => <StatusBadge status={r.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (r: ContentDoc) => <span className="text-muted text-xs font-medium">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white border border-emerald-500/40 hover:bg-emerald-500 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Accept Votes" value={String(stats.totalAccept)} icon={CheckCircle} color="var(--primary)" />
        <MetricCard title="Ignore Votes" value={String(stats.totalIgnore)} icon={Eye} color="#f59e0b" />
        <MetricCard title="Refuse Votes" value={String(stats.totalRefuse)} icon={XCircle} color="#ef4444" />
        <MetricCard
          title="Pending Review"
          value={String(stats.pendingCount)}
          icon={Vote}
          color="#3b82f6"
          trend={stats.pendingCount > 0 ? { value: "ACTIVE", isUp: true } : undefined}
        />
      </div>

      <div className="card">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search content by title, user, or BMID..."
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
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            selectedCount={selectedItems.length}
            onBulkApprove={() =>
              void bulkMutation.mutateAsync({
                ids: selectedItems,
                patch: { status: "approved", reviewedBy: user?.name || "Admin" },
              })
            }
            onBulkReject={() =>
              void bulkMutation.mutateAsync({
                ids: selectedItems,
                patch: { status: "rejected", reviewedBy: user?.name || "Admin", rejectionReason: "Rejected in bulk" },
              })
            }
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />
        </div>

        {listQuery.isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 mb-4">
            Failed to load content requests: {listQuery.error.message}
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
            selectedItems={selectedItems}
            onToggleItem={toggleItem}
            onSelectAll={selectAll}
            getId={(r) => r.id}
            onRowClick={(r) => {
              setSelectedId(r.id);
              setAdminNote("");
            }}
            emptyDescription="Change filters or search within the current result page."
            loading={listQuery.isLoading}
          />
        </div>
      </div>

      <DetailDrawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={`Content: ${selected?.postTitle || ""}`}
        variant="modal"
      >
        {!selected ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Author</p>
                <p className="font-bold text-main">{selected.userName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">BMID</p>
                {selected.bmidNumber ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    {selected.bmidNumber}
                  </span>
                ) : (
                  <p className="text-sm text-muted">—</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Request Type</p>
                <span
                  className={`inline-flex items-center gap-1 uppercase text-xs font-bold px-2.5 py-1 rounded-lg ${
                    selected.type === "duality"
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {selected.type === "duality" && <GitBranch className="w-3.5 h-3.5" />}
                  {selected.type === "own" ? "Own Request" : "Duality Request"}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">State</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Submitted</p>
                <p className="text-sm font-medium">{formatDate(selected.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Reviewed By</p>
                <p className="text-sm font-medium">{selected.reviewedBy || "Pending review"}</p>
              </div>
            </div>

            {selected.type === "duality" && selected.taggedUserName && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Duality Pairing</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted mb-0.5">Tagged User</p>
                    <p className="text-sm font-bold text-main">{selected.taggedUserName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted mb-0.5">Tagged User Action</p>
                    <StatusBadge status={selected.taggedUserAction || "pending"} />
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Original Title</p>
              <p className="font-extrabold text-main text-lg leading-tight">{selected.postTitle}</p>
            </div>

            {selected.postImageUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.postImageUrl} alt={selected.postTitle} className="max-h-80 w-full object-cover" />
              </div>
            ) : null}

            <div className="p-4 bg-background border border-border rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Content Extract</p>
              <p className="text-sm leading-relaxed text-main/80 italic">&ldquo;{selected.postPreview}&rdquo;</p>
            </div>

            {((selected.voteAccept || 0) + (selected.voteIgnore || 0) + (selected.voteRefuse || 0) > 0 ||
              selected.votingStatus) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Vote className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-main">
                    Community Vote
                    {selected.votingStatus && (
                      <StatusBadge status={selected.votingStatus} size="xs" />
                    )}
                  </h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Accept", value: selected.voteAccept || 0, color: "var(--primary)", icon: ThumbsUp },
                    { label: "Ignore", value: selected.voteIgnore || 0, color: "#f59e0b", icon: Minus },
                    { label: "Refuse", value: selected.voteRefuse || 0, color: "#ef4444", icon: ThumbsDown },
                  ].map((v) => {
                    const total = (selected.voteAccept || 0) + (selected.voteIgnore || 0) + (selected.voteRefuse || 0);
                    const pct = total > 0 ? Math.round((v.value / total) * 100) : 0;
                    const Icon = v.icon;
                    return (
                      <div key={v.label}>
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-xs font-bold text-main uppercase tracking-wide flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" style={{ color: v.color }} />
                            {v.label}
                          </span>
                          <span className="text-xs font-extrabold text-main">
                            {v.value}{" "}
                            <span className="text-[10px] text-muted font-bold">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-surface-hover rounded-full overflow-hidden border border-border/50">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: v.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selected.votingOutcome && (
                  <div className="flex items-center gap-2 pt-2">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Outcome:</p>
                    <StatusBadge status={selected.votingOutcome} />
                  </div>
                )}
              </div>
            )}

            {selected.adminNotes && selected.adminNotes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">
                  Admin Audit Trail
                </h3>
                {selected.adminNotes.map((note, i) => (
                  <div key={i} className="p-3 bg-background border border-border rounded-xl">
                    <p className="text-sm leading-relaxed text-main">{note.note}</p>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {note.by.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wide">
                        {note.by} <span className="mx-1 opacity-30">&bull;</span> {note.at}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

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

            <div className="flex flex-col md:flex-row gap-2">
              {(selected.status === "pending" || selected.status === "in_review") && (
                <>
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
                    Approve
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
                    Reject
                  </button>
                </>
              )}
            </div>

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

      <DetailDrawer
        open={createOpen}
        onClose={() => {
          if (createMutation.isPending) return;
          setCreateOpen(false);
        }}
        title="New BMID Content Request"
        variant="modal"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs text-tertiary">Request Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {(["own", "duality"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCreateForm((f) => ({ ...f, type: t }))}
                  disabled={createMutation.isPending}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    createForm.type === t
                      ? t === "duality"
                        ? "bg-purple-500/10 border-purple-500/30"
                        : "bg-blue-500/10 border-blue-500/30"
                      : "bg-white/[0.02] border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {t === "duality" ? (
                      <GitBranch className={`w-4 h-4 ${createForm.type === t ? "text-purple-400" : "text-muted"}`} />
                    ) : (
                      <FileText className={`w-4 h-4 ${createForm.type === t ? "text-blue-400" : "text-muted"}`} />
                    )}
                    <span
                      className={`text-sm font-bold uppercase ${
                        createForm.type === t ? (t === "duality" ? "text-purple-300" : "text-blue-300") : "text-muted"
                      }`}
                    >
                      {t === "own" ? "Own" : "Duality"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed">
                    {t === "own"
                      ? "User A creates the request and tags themselves. Admin review required."
                      : "User A creates the request and tags User B. Tagged user action matters."}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">
              {createForm.type === "own" ? "User (Owner) *" : "User A (Creator) *"}
            </label>
            <UserPicker
              token={apiToken!}
              value={selectedUserOption}
              onSelect={handleOwnerSelect}
              disabled={createMutation.isPending}
            />
          </div>

          {createForm.type === "duality" && (
            <div className="space-y-1.5">
              <label className="block text-xs text-tertiary">User B (Tagged User) *</label>
              <UserPicker
                token={apiToken!}
                value={taggedUserOption}
                onSelect={setTaggedUserOption}
                disabled={createMutation.isPending}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Post ID (from user&apos;s posts)</label>
            <select
              value={createForm.postId}
              onChange={(e) => handlePostSelect(e.target.value)}
              disabled={createMutation.isPending || !selectedUserOption || userPostsQuery.isLoading}
              className={NEUTRAL_FIELD_CLASS}
            >
              <option value="">
                {!selectedUserOption
                  ? "Select a user first"
                  : userPostsQuery.isLoading
                    ? "Loading posts..."
                    : "Select a post"}
              </option>
              {(userPostsQuery.data?.items || []).map((post) => (
                <option key={post.id} value={post.id}>
                  {post.id} - {post.title}
                </option>
              ))}
            </select>
            {userPostsQuery.isError ? (
              <p className="text-[11px] text-red-300">Failed to load user posts: {userPostsQuery.error.message}</p>
            ) : selectedUserOption && !userPostsQuery.isLoading && (userPostsQuery.data?.items.length || 0) === 0 ? (
              <p className="text-[11px] text-muted">No posts found for the selected user.</p>
            ) : (
              <p className="text-[11px] text-muted">Selecting a post will auto-fill title, image, and description.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Post Image URL</label>
            <input
              value={createForm.postImageUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, postImageUrl: e.target.value }))}
              disabled={createMutation.isPending}
              className={NEUTRAL_FIELD_CLASS}
              placeholder="Auto-filled from the selected post"
            />
            {createForm.postImageUrl ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={createForm.postImageUrl} alt={createForm.postTitle || "Post preview"} className="h-48 w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Post Title *</label>
            <input
              value={createForm.postTitle}
              onChange={(e) => setCreateForm((f) => ({ ...f, postTitle: e.target.value }))}
              disabled={createMutation.isPending}
              className={NEUTRAL_FIELD_CLASS}
              placeholder="Title of the post being transferred"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Post Preview / Description *</label>
            <textarea
              value={createForm.postPreview}
              onChange={(e) => setCreateForm((f) => ({ ...f, postPreview: e.target.value }))}
              disabled={createMutation.isPending}
              rows={3}
              className={NEUTRAL_FIELD_CLASS}
              placeholder="Brief description or preview of the content"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Request Flow</p>
            {createForm.type === "own" ? (
              <div className="space-y-1 text-xs text-secondary">
                <p>1. User creates a normal post in the app</p>
                <p>2. User taps &quot;Transfer to BMID Content&quot;</p>
                <p>3. Request is created with status &quot;Pending&quot;</p>
                <p>4. Admin reviews and approves/rejects</p>
                <p>5. Admin approval opens voting for verified users: Accept / Ignore / Refuse</p>
              </div>
            ) : (
              <div className="space-y-1 text-xs text-secondary">
                <p>1. User A creates a post and transfers to BMID Content</p>
                <p>2. User A tags User B in the duality request</p>
                <p>3. User B receives notification to accept/decline</p>
                <p>4. If User B accepts, request proceeds to admin review</p>
                <p>5. Admin approval opens voting for verified users: Accept / Ignore / Refuse</p>
              </div>
            )}
          </div>

          {createMutation.isError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              {createMutation.error.message}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-2">
            <button
              onClick={() => {
                setCreateOpen(false);
                setCreateForm({ postTitle: "", postPreview: "", postImageUrl: "", type: "own", postId: "" });
                setSelectedUserOption(null);
                setTaggedUserOption(null);
              }}
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 bg-white/5 text-secondary border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreateSubmit()}
              disabled={
                createMutation.isPending ||
                !selectedUserOption ||
                !createForm.postTitle.trim() ||
                !createForm.postPreview.trim() ||
                (createForm.type === "duality" && !taggedUserOption)
              }
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white border border-emerald-500/40 rounded-xl text-sm hover:bg-emerald-500 transition-colors disabled:opacity-60"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create {createForm.type === "own" ? "Own" : "Duality"} Request
            </button>
          </div>
        </div>
      </DetailDrawer>

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Delete selected requests?"
        message={
          <>
            <strong className="text-main">{selectedItems.length}</strong> request{selectedItems.length === 1 ? "" : "s"} will be permanently deleted from Firestore. This cannot be undone.
          </>
        }
        confirmLabel={bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        tone="danger"
        loading={bulkDeleteMutation.isPending}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void bulkDeleteMutation.mutateAsync(selectedItems)}
      />
    </div>
  );
}
