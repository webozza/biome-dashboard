"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BmidBoxPlatform, BmidBoxRequestType } from "@/lib/data/bmid-box";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  createBmidBoxRequest,
  fetchBmidBoxRequests,
  postBmidBoxAction,
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

const boardColumns = [
  { value: "submitted", label: "Submitted", tone: "border-cyan-500/20 bg-cyan-500/[0.03]" },
  { value: "pending_admin_review", label: "Admin Review", tone: "border-amber-500/20 bg-amber-500/[0.03]" },
  { value: "pending_tagged_user", label: "Tagged User", tone: "border-sky-500/20 bg-sky-500/[0.03]" },
  { value: "pending_voting", label: "Voting", tone: "border-violet-500/20 bg-violet-500/[0.03]" },
  { value: "approved", label: "Approved", tone: "border-green-500/20 bg-green-500/[0.03]" },
  { value: "refused", label: "Refused", tone: "border-red-500/20 bg-red-500/[0.03]" },
  { value: "removed", label: "Removed", tone: "border-zinc-500/20 bg-zinc-500/[0.03]" },
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery);

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
  const visibleColumns = useMemo(
    () =>
      filters.status && filters.status !== "all" && filters.status !== "pending"
        ? boardColumns.filter((column) => column.value === filters.status)
        : boardColumns.filter((column) => filters.status === "removed" || column.value !== "removed"),
    [filters.status]
  );
  const grouped = useMemo(
    () =>
      visibleColumns.map((column) => ({
        ...column,
        items: filtered.filter((request) => request.currentStatus === column.value),
      })),
    [filtered, visibleColumns]
  );

  const cards = [
    { title: "Total", value: summary?.total || 0, tone: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500" },
    { title: "Admin", value: summary?.pendingAdminReview || 0, tone: "border-amber-500/20 bg-amber-500/5 text-amber-500" },
    { title: "Tagged", value: summary?.pendingTaggedUser || 0, tone: "border-sky-500/20 bg-sky-500/5 text-sky-500" },
    { title: "Voting", value: summary?.pendingVoting || 0, tone: "border-violet-500/20 bg-violet-500/5 text-violet-500" },
    { title: "Approved", value: summary?.approved || 0, tone: "border-green-500/20 bg-green-500/5 text-green-500" },
    { title: "Refused", value: summary?.refused || 0, tone: "border-red-500/20 bg-red-500/5 text-red-500" },
    { title: "Removed", value: summary?.removed || 0, tone: "border-zinc-500/20 bg-zinc-500/5 text-zinc-500" },
  ];

  const activeFilterCount = Object.values(filters).filter((value) => value && value !== "all").length;

  function setFilterValue(key: string, value: string) {
    setFilters((current) => {
      const next = { ...current };
      if (value === "all") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function chipGroup(
    key: string,
    options: { value: string; label: string }[]
  ) {
    const active = filters[key] || "all";
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilterValue(key, "all")}
          className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
            active === "all"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-surface text-muted hover:text-main"
          }`}
        >
          All
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilterValue(key, option.value)}
            className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
              active === option.value
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted hover:text-main"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
            {filtered.length} visible
          </span>
          {activeFilterCount > 0 ? (
            <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
              {activeFilterCount} active
            </span>
          ) : null}
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-2xl border px-4 py-3 ${card.tone}`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{card.title}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl font-black tracking-tight text-main">{card.value}</span>
              <Box className="h-4 w-4 opacity-60" />
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="space-y-4 border-b border-border p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search request, owner, tagged user, or URL"
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm font-bold text-main outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilters({});
                  setSearchQuery("");
                }}
                className="rounded-xl border border-border bg-background px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted hover:text-main"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-500 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selectedIds.length}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-muted">Status</p>
              {chipGroup("status", statusOptions)}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-muted">Type</p>
                {chipGroup("type", typeOptions)}
              </div>
              <div>
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-muted">Platform</p>
                {chipGroup("platform", platformOptions)}
              </div>
              <div>
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-muted">Owner</p>
                {chipGroup("ownerVerified", [{ value: "verified", label: "Verified" }])}
              </div>
            </div>
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="grid gap-4 p-4 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
                <Box className="h-6 w-6 text-muted" />
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-main">No Box requests found</p>
              <p className="mt-2 text-xs text-muted">Try clearing a filter.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[1120px] gap-4" style={{ gridTemplateColumns: `repeat(${grouped.length}, minmax(260px, 1fr))` }}>
              {grouped.map((column) => (
                <div key={column.value} className={`rounded-2xl border ${column.tone}`}>
                  <div className="flex items-center justify-between border-b border-border px-3 py-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-main">{column.label}</p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                        {column.items.length} request{column.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusBadge status={column.value} size="xs" />
                  </div>

                  <div className="space-y-3 p-3">
                    {column.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-background/50 px-3 py-8 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                        Empty
                      </div>
                    ) : (
                      column.items.map((request) => {
                        const selected = selectedIds.includes(request.id);
                        return (
                          <article
                            key={request.id}
                            onClick={() => {
                              window.location.href = `/dashboard/bmid-box/requests/${request.id}`;
                            }}
                            className={`cursor-pointer rounded-2xl border border-border bg-background p-3 transition hover:border-primary/30 ${
                              selected ? "ring-2 ring-primary/20" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <Link
                                  href={`/dashboard/bmid-box/requests/${request.id}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="font-mono text-[10px] font-black text-primary"
                                >
                                  {request.id}
                                </Link>
                                <h3 className="mt-2 line-clamp-2 text-sm font-black leading-snug text-main">
                                  {request.previewData.title || "Untitled Box request"}
                                </h3>
                              </div>
                              <input
                                type="checkbox"
                                checked={selected}
                                onClick={(event) => event.stopPropagation()}
                                onChange={() => toggleSelected(request.id)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded-md accent-primary"
                              />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <StatusBadge status={request.type} size="xs" />
                              <span className={`inline-flex rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${platformTone[request.sourcePlatform]}`}>
                                {request.sourcePlatform}
                              </span>
                            </div>

                            <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2">
                              <p className="truncate text-xs font-black text-main">{request.ownerSnapshot?.name || "Unknown"}</p>
                              <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                                {request.ownerSnapshot?.bmidNumber || "No BMID"}
                              </p>
                            </div>

                            <a
                              href={request.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="mt-3 flex min-w-0 items-center gap-2 text-[11px] font-bold text-primary"
                            >
                              <span className="truncate">{request.sourceUrl}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>

                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                              <div className="flex gap-2 text-[10px] font-black uppercase tracking-wider">
                                <span className="text-emerald-500">{request.acceptCount} A</span>
                                <span className="text-amber-500">{request.ignoreCount} I</span>
                                <span className="text-red-500">{request.refuseCount} R</span>
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                                {formatDate(request.createdAt)}
                              </span>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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
