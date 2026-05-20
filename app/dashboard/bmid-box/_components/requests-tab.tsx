"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  CheckCircle,
  Clock,
  GitBranch,
  Loader2,
  Minus,
  Plus,
  ShieldX,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Vote,
  X,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BmidBoxPlatform, BmidBoxRequest, BmidBoxRequestType } from "@/lib/data/bmid-box";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  createBmidBoxRequest,
  fetchBmidBoxRequests,
  postBmidBoxAction,
} from "@/lib/bmid-box-client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDate } from "@/lib/format";

const platformTone: Record<string, string> = {
  instagram: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  tiktok: "bg-white/5 text-white border-white/10",
  youtube: "bg-red-500/10 text-red-400 border-red-500/20",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "pending_admin_review", label: "Admin" },
  { value: "pending_tagged_user", label: "Tagged" },
  { value: "pending_voting", label: "Voting" },
  { value: "approved", label: "Approved" },
  { value: "refused", label: "Refused" },
  { value: "removed", label: "Removed" },
];

const typeOptions = [
  { value: "own", label: "Own" },
  { value: "duality", label: "Duality" },
];

const platformOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
];

type CreateFormState = {
  owner: UserPickerOption | null;
  tagged: UserPickerOption | null;
  type: BmidBoxRequestType;
  platform: BmidBoxPlatform;
  sourceUrl: string;
  title: string;
  caption: string;
  description: string;
  thumbnailUrl: string;
  contentType: "video" | "photo" | "post";
};

const emptyForm: CreateFormState = {
  owner: null,
  tagged: null,
  type: "own",
  platform: "instagram",
  sourceUrl: "",
  title: "",
  caption: "",
  description: "",
  thumbnailUrl: "",
  contentType: "post",
};

export function RequestsTab() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const apiToken = useAuthStore((state) => state.apiToken);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(initialStatus ? { status: initialStatus } : {});
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery);
  const pageSize = 10;

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          postBmidBoxAction<unknown>(apiToken!, `/api/bmid-box/requests/${id}/remove`, {
            actorName: "Admin",
            removalReason: "Removed via bulk delete",
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bmid-box"] });
      setSelectedIds([]);
      setConfirmDelete(false);
      setCurrentPage(1);
    },
  });

  const listQuery = useQuery({
    queryKey: ["bmid-box", "requests"],
    queryFn: () => fetchBmidBoxRequests(apiToken!),
    enabled: Boolean(apiToken),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createBmidBoxRequest(apiToken!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bmid-box"] });
      setShowCreate(false);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError((err as Error).message),
  });

  function submitCreate() {
    setFormError(null);
    if (!form.owner) return setFormError("Select an owner user");
    if (!form.sourceUrl.trim()) return setFormError("Source URL is required");
    if (form.type === "duality" && !form.tagged) return setFormError("Duality requests need a tagged user");

    const payload: Record<string, unknown> = {
      ownerUserId: form.owner.id,
      ownerName: form.owner.displayName,
      type: form.type,
      sourceUrl: form.sourceUrl.trim(),
      sourcePlatform: form.platform,
      actorName: "Admin (test)",
      previewData: {
        title: form.title.trim() || "New BMID Box request",
        caption: form.caption.trim(),
        description: form.description.trim(),
        thumbnailUrl:
          form.thumbnailUrl.trim() ||
          "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
        embedEnabled: true,
        contentType: form.contentType,
      },
    };

    if (form.type === "duality" && form.tagged) {
      payload.taggedUserId = form.tagged.id;
      payload.taggedName = form.tagged.displayName;
    }

    createMutation.mutate(payload);
  }

  const filtered = useMemo(() => {
    const items = listQuery.data?.items || [];
    const q = deferredSearch.trim().toLowerCase();

    return items.filter((request) => {
      const searchHaystack = [
        request.id,
        request.sourceUrl,
        request.ownerSnapshot?.name || "",
        request.taggedSnapshot?.name || "",
        request.previewData.title,
      ]
        .join(" ")
        .toLowerCase();

      if (q && !searchHaystack.includes(q)) return false;
      if (filters.status && filters.status !== "all") {
        if (filters.status === "pending") {
          if (!["submitted", "pending_admin_review", "pending_tagged_user", "pending_voting"].includes(request.currentStatus)) return false;
        } else if (request.currentStatus !== filters.status) return false;
      } else if (request.currentStatus === "removed") {
        return false;
      }
      if (filters.type && filters.type !== "all" && request.type !== filters.type) return false;
      if (filters.platform && filters.platform !== "all" && request.sourcePlatform !== filters.platform) return false;
      if (filters.ownerVerified === "verified" && !request.ownerVerified) return false;
      return true;
    });
  }, [deferredSearch, filters, listQuery.data?.items]);

  const summary = listQuery.data?.summary;
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  function setFilterValue(key: string, value: string) {
    setFilters((current) => {
      const next = { ...current };
      if (value === "all") delete next[key];
      else next[key] = value;
      return next;
    });
    setCurrentPage(1);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const columns = [
    {
      key: "id",
      label: "Request",
      render: (request: BmidBoxRequest & { id: string }) => (
        <Link
          href={`/dashboard/bmid-box/requests/${request.id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-mono text-[10px] font-bold text-primary"
        >
          {request.id}
        </Link>
      ),
    },
    {
      key: "preview",
      label: "Item",
      render: (request: BmidBoxRequest & { id: string }) => (
        <div className="max-w-[280px]">
          <p className="line-clamp-1 font-bold text-main">{request.previewData.title || "Untitled Box request"}</p>
          <p className="line-clamp-1 text-xs text-muted">
            {request.previewData.caption || request.previewData.description || request.sourceUrl}
          </p>
        </div>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      render: (request: BmidBoxRequest & { id: string }) => (
        <div>
          <p className="font-bold text-main">{request.ownerSnapshot?.name || "Unknown"}</p>
          <p className="text-[10px] font-medium text-muted">{request.ownerSnapshot?.bmidNumber || "No BMID"}</p>
        </div>
      ),
    },
    {
      key: "tagged",
      label: "Tagged",
      render: (request: BmidBoxRequest & { id: string }) => (
        <span className="font-medium text-main">{request.taggedSnapshot?.name || "Same as owner"}</span>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (request: BmidBoxRequest & { id: string }) => (
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
            request.type === "duality"
              ? "border border-purple-500/20 bg-purple-500/10 text-purple-400"
              : "bg-surface-hover text-muted"
          }`}
        >
          {request.type === "duality" ? <GitBranch className="h-3 w-3" /> : null}
          {request.type}
        </span>
      ),
    },
    {
      key: "platform",
      label: "Platform",
      render: (request: BmidBoxRequest & { id: string }) => (
        <span className={`inline-flex rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${platformTone[request.sourcePlatform]}`}>
          {request.sourcePlatform}
        </span>
      ),
    },
    {
      key: "votes",
      label: "Votes",
      render: (request: BmidBoxRequest & { id: string }) => {
        const total = request.acceptCount + request.ignoreCount + request.refuseCount;
        if (total === 0) return <span className="text-xs text-muted">-</span>;
        return (
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-0.5 text-emerald-400">
              <ThumbsUp className="h-3 w-3" /> {request.acceptCount}
            </span>
            <span className="flex items-center gap-0.5 text-amber-400">
              <Minus className="h-3 w-3" /> {request.ignoreCount}
            </span>
            <span className="flex items-center gap-0.5 text-red-400">
              <ThumbsDown className="h-3 w-3" /> {request.refuseCount}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (request: BmidBoxRequest & { id: string }) => <StatusBadge status={request.currentStatus} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (request: BmidBoxRequest & { id: string }) => (
        <span className="text-xs font-medium text-muted">{formatDate(request.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (request: BmidBoxRequest & { id: string }) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedIds([request.id]);
            setConfirmDelete(true);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#ef4444] transition-colors hover:border-[#ef4444]/20 hover:bg-[#ef4444]/10"
          title="Remove request"
          aria-label="Remove request"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">BMID Box Table</p>
          <p className="mt-1 text-sm font-medium text-muted">
            {filtered.length} visible request{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setFormError(null);
            setShowCreate(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <MetricCard title="Total Requests" value={summary?.total || 0} icon={Box} color="#06b6d4" />
        <MetricCard title="Admin Review" value={summary?.pendingAdminReview || 0} icon={Clock} color="#f59e0b" />
        <MetricCard title="Tagged User" value={summary?.pendingTaggedUser || 0} icon={GitBranch} color="#0ea5e9" />
        <MetricCard title="Voting Queue" value={summary?.pendingVoting || 0} icon={Vote} color="#8b5cf6" />
        <MetricCard title="Approved" value={summary?.approved || 0} icon={CheckCircle} color="var(--primary)" />
        <MetricCard title="Refused" value={summary?.refused || 0} icon={XCircle} color="#ef4444" />
        <MetricCard title="Removed" value={summary?.removed || 0} icon={ShieldX} color="#6b7280" />
      </div>

      <div className="card">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search request, owner, tagged user, title, or URL..."
            filters={[
              { key: "status", label: "Status", options: statusOptions },
              { key: "type", label: "Type", options: typeOptions },
              { key: "platform", label: "Platform", options: platformOptions },
              { key: "ownerVerified", label: "Owner", options: [{ value: "verified", label: "Verified" }] },
            ]}
            activeFilters={filters}
            onFilterChange={setFilterValue}
            onClearFilters={() => {
              setFilters({});
              setSearchQuery("");
              setCurrentPage(1);
            }}
            selectedCount={selectedIds.length}
            onBulkDelete={() => setConfirmDelete(true)}
          />
        </div>

        {listQuery.isError ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            Failed to load Box requests: {listQuery.error.message}
          </div>
        ) : null}

        <div className="relative">
          {listQuery.isFetching ? (
            <div className="absolute right-3 top-[-10px] z-10 flex items-center gap-2 rounded-full border border-white/10 bg-surface/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing
            </div>
          ) : null}
          <DataTable
            columns={columns}
            data={rows}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            selectedItems={selectedIds}
            onToggleItem={toggleSelected}
            onSelectAll={(ids) => setSelectedIds(ids)}
            getId={(request) => request.id}
            onRowClick={(request) => {
              window.location.href = `/dashboard/bmid-box/requests/${request.id}`;
            }}
            emptyMessage="No Box requests found"
            emptyDescription="Change filters or search within the current result set."
            loading={listQuery.isLoading}
          />
        </div>
      </div>

      {showCreate && typeof document !== "undefined" ? createPortal(
        <>
          <div
            onClick={() => setShowCreate(false)}
            className="fixed inset-0 z-[190] bg-black/60 backdrop-blur-md animate-fade-in"
          />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 pointer-events-none animate-fade-in">
            <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] border border-border bg-surface/95 shadow-2xl backdrop-blur-3xl pointer-events-auto flex flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-5 border-b border-border bg-surface/40 backdrop-blur-3xl">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-xl font-black tracking-tighter text-main uppercase italic truncate">
                    New BMID Box Request
                  </h2>
                  <p className="text-[10px] font-black tracking-[0.3em] text-muted uppercase opacity-50 truncate">
                    Admin Test Submission
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="shrink-0 w-10 h-10 rounded-xl bg-surface-hover border border-border text-muted hover:text-main transition-all active:scale-90 flex items-center justify-center group"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Type</label>
                  <div className="flex gap-2">
                    {(["own", "duality"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, type: value, tagged: value === "own" ? null : current.tagged }))}
                        className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                          form.type === value
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-white/10 bg-white/[0.03] text-muted hover:text-main"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as BmidBoxPlatform }))}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Owner (verified)</label>
                <UserPicker
                  token={apiToken || ""}
                  value={form.owner}
                  onSelect={(user) => setForm((current) => ({ ...current, owner: user }))}
                  verifiedOnly
                />
              </div>

              {form.type === "duality" ? (
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Tagged User (verified)</label>
                  <UserPicker
                    token={apiToken || ""}
                    value={form.tagged}
                    onSelect={(user) => setForm((current) => ({ ...current, tagged: user }))}
                    verifiedOnly
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Source URL</label>
                <input
                  value={form.sourceUrl}
                  onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                  placeholder="https://instagram.com/p/..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Title</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Studio clip"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Content Type</label>
                  <select
                    value={form.contentType}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contentType: event.target.value as CreateFormState["contentType"] }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                  >
                    <option value="video">Video</option>
                    <option value="photo">Photo</option>
                    <option value="post">Post</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Caption</label>
                <input
                  value={form.caption}
                  onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Thumbnail URL (optional)</label>
                <input
                  value={form.thumbnailUrl}
                  onChange={(event) => setForm((current) => ({ ...current, thumbnailUrl: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                />
              </div>

              {formError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{formError}</div>
              ) : null}
            </div>

              <div className="flex items-center justify-end gap-3 border-t border-border bg-surface/40 backdrop-blur-3xl px-6 py-4">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-border bg-surface px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:text-main"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCreate}
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}

      <ConfirmModal
        open={confirmDelete}
        title={`Remove ${selectedIds.length} Box request${selectedIds.length === 1 ? "" : "s"}?`}
        message="Selected requests will be marked as removed. This keeps the audit trail but hides them from the active queue."
        confirmLabel={bulkDeleteMutation.isPending ? "Removing…" : "Remove"}
        tone="danger"
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
