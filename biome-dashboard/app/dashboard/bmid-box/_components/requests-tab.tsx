"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BmidBoxPlatform, BmidBoxRequest, BmidBoxRequestType } from "@/lib/data/bmid-box";
import { DataTable } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  createBmidBoxRequest,
  fetchBmidBoxRequests,
  postBmidBoxAction,
  resetBmidBoxRequestsApi,
  seedBmidBoxRequestsApi,
} from "@/lib/bmid-box-client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDate } from "@/lib/format";
import { Box } from "lucide-react";

const platformTone: Record<string, string> = {
  instagram: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  tiktok: "bg-white/5 text-white border-white/10",
  youtube: "bg-red-500/10 text-red-400 border-red-500/20",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

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
  const apiToken = useAuthStore((state) => state.apiToken);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
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
    },
  });

  const listQuery = useQuery({
    queryKey: ["bmid-box", "requests"],
    queryFn: () => fetchBmidBoxRequests(apiToken!),
    enabled: Boolean(apiToken),
  });

  const seedMutation = useMutation({
    mutationFn: (force: boolean) => seedBmidBoxRequestsApi(apiToken!, force),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bmid-box"] });
      window.alert(
        `Seed complete. Inserted ${result.insertedCount}, skipped ${result.skippedCount} of ${result.totalSeedFixtures}.`
      );
    },
    onError: (err: unknown) => window.alert(`Seed failed: ${(err as Error).message}`),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetBmidBoxRequestsApi(apiToken!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bmid-box"] });
      window.alert(`Deleted ${result.deletedCount} Box requests.`);
    },
    onError: (err: unknown) => window.alert(`Reset failed: ${(err as Error).message}`),
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
        if (request.currentStatus !== filters.status) return false;
      } else if (request.currentStatus === "removed") {
        return false;
      }
      if (filters.type && filters.type !== "all" && request.type !== filters.type) return false;
      if (filters.platform && filters.platform !== "all" && request.sourcePlatform !== filters.platform) return false;
      if (filters.ownerVerified === "verified" && !request.ownerVerified) return false;
      return true;
    });
  }, [deferredSearch, filters, listQuery.data?.items]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const summary = listQuery.data?.summary;

  const cards = [
    { title: "Total", value: summary?.total || 0, color: "#10b981" },
    { title: "Admin Review", value: summary?.pendingAdminReview || 0, color: "#f59e0b" },
    { title: "Tagged User", value: summary?.pendingTaggedUser || 0, color: "#3b82f6" },
    { title: "Voting", value: summary?.pendingVoting || 0, color: "#8b5cf6" },
    { title: "Approved", value: summary?.approved || 0, color: "#22c55e" },
    { title: "Refused", value: summary?.refused || 0, color: "#ef4444" },
    { title: "Removed", value: summary?.removed || 0, color: "#6b7280" },
  ];

  const columns = [
    {
      key: "id",
      label: "Request",
      render: (request: BmidBoxRequest & { id: string }) => (
        <Link href={`/dashboard/bmid-box/requests/${request.id}`} className="font-mono text-[10px] text-primary font-bold">
          {request.id}
        </Link>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      render: (request: BmidBoxRequest & { id: string }) => (
        <div>
          <p className="font-bold text-main">{request.ownerSnapshot?.name || "Unknown"}</p>
          <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
            {request.ownerSnapshot?.bmidNumber || "No BMID"}
          </p>
        </div>
      ),
    },
    {
      key: "tagged",
      label: "Tagged",
      render: (request: BmidBoxRequest & { id: string }) => (
        <div>
          <p className="font-bold text-main">{request.taggedSnapshot?.name || "Same as owner"}</p>
          <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
            {request.type === "own" ? "Own" : request.taggedSnapshot?.bmidNumber || "Unverified"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (request: BmidBoxRequest & { id: string }) => <StatusBadge status={request.type} size="xs" />,
    },
    {
      key: "platform",
      label: "Platform",
      render: (request: BmidBoxRequest & { id: string }) => (
        <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${platformTone[request.sourcePlatform]}`}>
          {request.sourcePlatform}
        </span>
      ),
    },
    {
      key: "url",
      label: "Link",
      render: (request: BmidBoxRequest & { id: string }) => (
        <a href={request.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary text-sm font-medium">
          <span className="truncate max-w-[220px]">{request.sourceUrl}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (request: BmidBoxRequest & { id: string }) => <StatusBadge status={request.currentStatus} />,
    },
    {
      key: "votes",
      label: "Votes",
      render: (request: BmidBoxRequest & { id: string }) => (
        <div className="flex gap-2 text-[10px] font-black uppercase tracking-wider">
          <span className="text-emerald-400">{request.acceptCount} A</span>
          <span className="text-amber-400">{request.ignoreCount} I</span>
          <span className="text-red-400">{request.refuseCount} R</span>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (request: BmidBoxRequest & { id: string }) => <span className="text-xs text-muted">{formatDate(request.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
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
        <button
          onClick={() => seedMutation.mutate(false)}
          disabled={seedMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-main transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
        >
          {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Seed Demo
        </button>
        <button
          onClick={() => {
            if (window.confirm("Delete ALL Box requests from Firestore?")) resetMutation.mutate();
          }}
          disabled={resetMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
        >
          {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={Box}
            color={card.color}
            trend={{ value: listQuery.isFetching ? "SYNC" : "LIVE", isUp: true }}
            loading={listQuery.isLoading}
          />
        ))}
      </div>

      <div className="card p-6">
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search request, owner, tagged user, or URL..."
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "submitted", label: "Submitted" },
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
              key: "platform",
              label: "Platform",
              options: [
                { value: "instagram", label: "Instagram" },
                { value: "tiktok", label: "TikTok" },
                { value: "youtube", label: "YouTube" },
                { value: "facebook", label: "Facebook" },
              ],
            },
            {
              key: "ownerVerified",
              label: "Verified",
              options: [
                { value: "verified", label: "Verified Only" },
                { value: "all", label: "All" },
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
          selectedCount={selectedIds.length}
          onBulkDelete={() => setConfirmDelete(true)}
        />

        <DataTable
          columns={columns}
          data={rows}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          getId={(request) => request.id}
          selectedItems={selectedIds}
          onToggleItem={(id) =>
            setSelectedIds((current) =>
              current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
            )
          }
          onSelectAll={(ids) => setSelectedIds(ids)}
          onRowClick={(request) => {
            window.location.href = `/dashboard/bmid-box/requests/${request.id}`;
          }}
          emptyMessage="No Box requests found"
          emptyDescription="Try a different filter or seed demo data"
          loading={listQuery.isLoading}
        />
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
