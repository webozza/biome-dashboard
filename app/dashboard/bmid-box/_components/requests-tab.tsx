"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  CheckCircle,
  Clock,
  ExternalLink,
  GitBranch,
  Image as ImageIcon,
  Loader2,
  Minus,
  Play,
  Plus,
  RefreshCw,
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
  fetchBmidSocialPreview,
  fetchBmidBoxRequests,
  postBmidBoxAction,
  type BmidSocialPreviewData,
} from "@/lib/bmid-box-client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDate } from "@/lib/format";

const platformTone: Record<string, string> = {
  instagram: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  tiktok: "bg-white/5 text-white border-white/10",
  youtube: "bg-red-500/10 text-red-400 border-red-500/20",
  facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  x: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  generic: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
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
  { value: "own", label: "Origin" },
  { value: "duality", label: "Share" },
];

const platformOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X / Twitter" },
  { value: "generic", label: "Generic Link" },
];

type PreviewState = "idle" | "loading" | "ready" | "unavailable" | "failed";
type DirtyField = "platform" | "sourceUrl" | "title" | "caption" | "description" | "thumbnailUrl" | "contentType";

type CreateFormState = {
  owner: UserPickerOption | null;
  tagged: UserPickerOption[];
  taggedDraft: UserPickerOption | null;
  type: BmidBoxRequestType;
  platform: BmidBoxPlatform;
  sourceUrl: string;
  title: string;
  caption: string;
  description: string;
  thumbnailUrl: string;
  contentType: "video" | "photo" | "image" | "post" | "link";
};

const emptyForm: CreateFormState = {
  owner: null,
  tagged: [],
  taggedDraft: null,
  type: "own",
  platform: "instagram",
  sourceUrl: "",
  title: "",
  caption: "",
  description: "",
  thumbnailUrl: "",
  contentType: "post",
};

function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim() !== "null" && value.trim() !== "undefined";
}

function sanitizeSocialUrlInput(value: string) {
  return value.trim().replace(/[),.]+$/g, "");
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizePlatform(value: unknown): BmidBoxPlatform | null {
  if (!validText(value)) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "twitter") return "x";
  if (["instagram", "tiktok", "youtube", "facebook", "x", "generic"].includes(normalized)) {
    return normalized as BmidBoxPlatform;
  }
  return null;
}

function detectPlatformFromUrl(value: string): BmidBoxPlatform | null {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("facebook.com") || hostname.includes("fb.watch")) return "facebook";
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return "x";
    return "generic";
  } catch {
    return null;
  }
}

function normalizeContentType(value: unknown): CreateFormState["contentType"] | null {
  if (!validText(value)) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "photo") return "image";
  if (["video", "image", "post", "link"].includes(normalized)) return normalized as CreateFormState["contentType"];
  return null;
}

function previewErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("invalid_social_url")) return "Invalid social media URL.";
  if (message.includes("preview_timeout")) return "Preview request timed out.";
  if (message.includes("unsupported")) return "This platform is not currently supported.";
  if (message.includes("preview_unavailable")) return "The platform did not return preview information.";
  return "Preview could not be loaded. You can still enter the information manually.";
}

function setDirty(current: Set<DirtyField>, field: DirtyField) {
  const next = new Set(current);
  next.add(field);
  return next;
}

function platformLabel(value: string | undefined) {
  const option = platformOptions.find((item) => item.value === value);
  return option?.label || value || "Social";
}

function contentTypeLabel(value: string | undefined) {
  if (value === "image" || value === "photo") return "Image";
  if (value === "video") return "Video";
  if (value === "link") return "Link";
  return "Post";
}

function taggedBoxNames(request: BmidBoxRequest) {
  if (request.taggedSnapshots?.length) return request.taggedSnapshots.map((tagged) => tagged.name).join(", ");
  if (request.taggedUsers?.length) return request.taggedUsers.map((tagged) => tagged.name).join(", ");
  return request.taggedSnapshot?.name || "Same as owner";
}

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
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [socialPreview, setSocialPreview] = useState<BmidSocialPreviewData | null>(null);
  const [dirtyFields, setDirtyFields] = useState<Set<DirtyField>>(() => new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastFetchedUrlRef = useRef("");
  const activePreviewRequestRef = useRef(0);
  const deferredSearch = useDeferredValue(searchQuery);
  const pageSize = 10;

  const resetCreateForm = useCallback(() => {
    setForm(emptyForm);
    setFormError(null);
    setPreviewState("idle");
    setPreviewError(null);
    setSocialPreview(null);
    setDirtyFields(new Set());
    lastFetchedUrlRef.current = "";
  }, []);

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
      resetCreateForm();
    },
    onError: (err: unknown) => setFormError((err as Error).message),
  });

  const applyPreviewToForm = useCallback((preview: BmidSocialPreviewData, originalUrl: string) => {
    setForm((current) => {
      const next = { ...current };
      const platform = normalizePlatform(preview.platform);
      const contentType = normalizeContentType(preview.type);
      const sourceUrl = validText(preview.canonicalUrl) ? preview.canonicalUrl.trim() : originalUrl;

      if (platform) next.platform = platform;
      if (sourceUrl && !dirtyFields.has("sourceUrl")) next.sourceUrl = sourceUrl;
      if (validText(preview.title) && !dirtyFields.has("title")) next.title = preview.title!.trim();
      if (validText(preview.caption) && !dirtyFields.has("caption")) next.caption = preview.caption!.trim();
      if (validText(preview.description) && !dirtyFields.has("description")) next.description = preview.description!.trim();
      if (validText(preview.thumbnailUrl) && !dirtyFields.has("thumbnailUrl")) next.thumbnailUrl = preview.thumbnailUrl!.trim();
      if (contentType && !dirtyFields.has("contentType")) next.contentType = contentType;

      return next;
    });
  }, [dirtyFields]);

  const loadSocialPreview = useCallback(async (url: string, options: { force?: boolean } = {}) => {
    const original = url.trim();
    const trimmed = sanitizeSocialUrlInput(url);
    if (!trimmed) {
      setPreviewState("idle");
      setPreviewError(null);
      setSocialPreview(null);
      return;
    }
    if (!isValidHttpUrl(trimmed)) {
      setPreviewState("failed");
      setPreviewError("Invalid social media URL.");
      setSocialPreview(null);
      return;
    }
    if (!apiToken) return;
    if (!options.force && lastFetchedUrlRef.current === trimmed) return;
    if (original && original !== trimmed) {
      setForm((current) => current.sourceUrl.trim() === original ? { ...current, sourceUrl: trimmed } : current);
    }

    const requestId = activePreviewRequestRef.current + 1;
    activePreviewRequestRef.current = requestId;
    lastFetchedUrlRef.current = trimmed;
    setPreviewState("loading");
    setPreviewError(null);
    setSocialPreview(null);

    try {
      const result = await fetchBmidSocialPreview(apiToken, trimmed);
      if (activePreviewRequestRef.current !== requestId) return;
      const data = result.data || {};
      if (validText(data.canonicalUrl)) lastFetchedUrlRef.current = data.canonicalUrl.trim();
      setSocialPreview(data);
      if (data.status === "unavailable") {
        setPreviewState("unavailable");
        setPreviewError("This post may be private or unavailable.");
      } else {
        setPreviewState("ready");
        applyPreviewToForm(data, trimmed);
      }
    } catch (err) {
      if (activePreviewRequestRef.current !== requestId) return;
      setPreviewState("failed");
      setSocialPreview(null);
      setPreviewError(previewErrorMessage(err));
    }
  }, [apiToken, applyPreviewToForm]);

  useEffect(() => {
    if (!showCreate) return;
    const url = form.sourceUrl.trim();
    if (!url) return;
    const timer = window.setTimeout(() => {
      void loadSocialPreview(url);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [form.sourceUrl, loadSocialPreview, showCreate]);

  function submitCreate() {
    setFormError(null);
    if (!form.owner) return setFormError("Select an owner user");
    const sourceUrl = sanitizeSocialUrlInput(form.sourceUrl);
    if (!sourceUrl) return setFormError("Source URL is required");
    if (form.type === "duality" && form.tagged.length === 0) return setFormError("Share requests need at least one tagged user");

    const payload: Record<string, unknown> = {
      ownerUserId: form.owner.id,
      ownerName: form.owner.displayName,
      type: form.type,
      sourceUrl,
      sourcePlatform: form.platform,
      actorName: "Admin (test)",
      previewData: {
        title: form.title.trim(),
        caption: form.caption.trim(),
        description: form.description.trim(),
        thumbnailUrl: form.thumbnailUrl.trim(),
        embedEnabled: true,
        contentType: form.contentType,
      },
      socialPreview: socialPreview
        ? {
            platform: socialPreview.platform,
            type: socialPreview.type,
            authorName: socialPreview.authorName,
            authorUsername: socialPreview.authorUsername,
            canonicalUrl: socialPreview.canonicalUrl,
            embedUrl: socialPreview.embedUrl,
            externalUrl: socialPreview.externalUrl,
            status: socialPreview.status,
          }
        : null,
    };

    if (form.type === "duality" && form.tagged.length > 0) {
      payload.taggedUserIds = form.tagged.map((user) => user.id);
      payload.taggedName = form.tagged.map((user) => user.displayName).join(", ");
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
        taggedBoxNames(request),
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
        <span className="font-medium text-main">{taggedBoxNames(request)}</span>
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
            resetCreateForm();
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
                        onClick={() => setForm((current) => ({ ...current, type: value, tagged: value === "own" ? [] : current.tagged, taggedDraft: null }))}
                        className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                          form.type === value
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-white/10 bg-white/[0.03] text-muted hover:text-main"
                        }`}
                      >
                        {value === "own" ? "Origin" : "Share"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(event) => {
                      setDirtyFields((current) => setDirty(current, "platform"));
                      setForm((current) => ({ ...current, platform: event.target.value as BmidBoxPlatform }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="facebook">Facebook</option>
                    <option value="x">X / Twitter</option>
                    <option value="generic">Generic Link</option>
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
                    value={form.taggedDraft}
                    onSelect={(user) =>
                      setForm((current) => ({
                        ...current,
                        taggedDraft: null,
                        tagged:
                          user.id === current.owner?.id || current.tagged.some((item) => item.id === user.id)
                            ? current.tagged
                            : [...current.tagged, user],
                      }))
                    }
                    verifiedOnly
                  />
                  {form.tagged.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {form.tagged.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              tagged: current.tagged.filter((item) => item.id !== user.id),
                            }))
                          }
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-main hover:border-red-500/30 hover:text-red-300"
                        >
                          {user.displayName} x
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Source URL</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <input
                      value={form.sourceUrl}
                      onChange={(event) => {
                        const nextUrl = event.target.value;
                        const trimmed = nextUrl.trim();
                        const detectedPlatform = detectPlatformFromUrl(trimmed);
                        setForm((current) => ({
                          ...current,
                          sourceUrl: nextUrl,
                          platform: detectedPlatform || current.platform,
                        }));
                        if (!trimmed) {
                          setPreviewState("idle");
                          setPreviewError(null);
                          setSocialPreview(null);
                          lastFetchedUrlRef.current = "";
                        } else if (lastFetchedUrlRef.current && lastFetchedUrlRef.current !== trimmed) {
                          setPreviewState("idle");
                          setPreviewError(null);
                          setSocialPreview(null);
                        }
                      }}
                      onBlur={() => void loadSocialPreview(form.sourceUrl)}
                      placeholder="https://instagram.com/p/..."
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 pr-28 text-sm text-main outline-none focus:border-white/20"
                    />
                    {previewState === "loading" ? (
                      <span className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadSocialPreview(form.sourceUrl, { force: true })}
                    disabled={!form.sourceUrl.trim() || previewState === "loading"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
                  >
                    {previewState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh Preview
                  </button>
                </div>
                {previewState === "loading" ? (
                  <p className="mt-2 text-xs font-medium text-muted">Loading social media data...</p>
                ) : null}
                {previewState === "failed" && previewError ? (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {previewError}
                  </div>
                ) : null}
                {previewState === "unavailable" ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted">
                    {previewError || "The platform did not return preview information."} You can still enter the information manually.
                  </div>
                ) : null}
              </div>

              {previewState === "ready" && socialPreview ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Social Media Preview</p>
                  <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                    <a
                      href={socialPreview.externalUrl || socialPreview.canonicalUrl || form.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20"
                    >
                      {socialPreview.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={socialPreview.thumbnailUrl} alt={socialPreview.title || "Social media preview"} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted" />
                      )}
                      {normalizeContentType(socialPreview.type) === "video" ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white">
                            <Play className="ml-0.5 h-5 w-5 fill-current" />
                          </span>
                        </span>
                      ) : null}
                    </a>
                    <div className="min-w-0 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                        {platformLabel(socialPreview.platform)} · {contentTypeLabel(socialPreview.type)}
                      </p>
                      <p className="line-clamp-2 text-sm font-extrabold text-main">
                        {socialPreview.title || "Untitled social post"}
                      </p>
                      {socialPreview.authorName ? (
                        <p className="text-xs font-medium text-muted">{socialPreview.authorName}</p>
                      ) : null}
                      {socialPreview.authorUsername ? (
                        <p className="text-xs font-black tracking-wide text-primary">@{socialPreview.authorUsername}</p>
                      ) : null}
                      <a
                        href={socialPreview.externalUrl || socialPreview.canonicalUrl || form.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Original Post
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Title</label>
                  <input
                    value={form.title}
                    onChange={(event) => {
                      setDirtyFields((current) => setDirty(current, "title"));
                      setForm((current) => ({ ...current, title: event.target.value }));
                    }}
                    placeholder="Studio clip"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Content Type</label>
                  <select
                    value={form.contentType}
                    onChange={(event) => {
                      setDirtyFields((current) => setDirty(current, "contentType"));
                      setForm((current) => ({ ...current, contentType: event.target.value as CreateFormState["contentType"] }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                  >
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                    <option value="post">Post</option>
                    <option value="link">Link</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Caption</label>
                <input
                  value={form.caption}
                  onChange={(event) => {
                    setDirtyFields((current) => setDirty(current, "caption"));
                    setForm((current) => ({ ...current, caption: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => {
                    setDirtyFields((current) => setDirty(current, "description"));
                    setForm((current) => ({ ...current, description: event.target.value }));
                  }}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-main outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-muted">Thumbnail URL (optional)</label>
                <input
                  value={form.thumbnailUrl}
                  onChange={(event) => {
                    setDirtyFields((current) => setDirty(current, "thumbnailUrl"));
                    setForm((current) => ({ ...current, thumbnailUrl: event.target.value }));
                  }}
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
                  disabled={createMutation.isPending || previewState === "loading"}
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
