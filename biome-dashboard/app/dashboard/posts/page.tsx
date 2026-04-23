"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { FileText, Loader2, Image as ImageIcon, User, Calendar, Trash2, Hash } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { readJson } from "@/lib/http";
import { AuthGate } from "@/components/ui/auth-gate";

type PostRow = {
  id: string;
  ownerId: string;
  authorName: string;
  authorUsername: string | null;
  authorEmail: string;
  authorPhotoURL: string | null;
  title: string;
  description: string;
  imageUrl: string | null;
  createdAt: string | null;
};

type PostListResponse = {
  items: PostRow[];
  total: number;
  scanned: number;
};

function formatDate(value: unknown) {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

export default function PostsPage() {
  const queryClient = useQueryClient();
  const apiToken = useAuthStore((s) => s.apiToken);
  const { searchQuery, setSearchQuery, itemsPerPage } = useDashboardStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PostRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery.trim());

  const listQuery = useQuery({
    queryKey: ["posts", "list", { deferredSearch, itemsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(Math.max(itemsPerPage, 50)) });
      if (deferredSearch) params.set("q", deferredSearch);
      const resp = await fetch(`/api/posts?${params}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<PostListResponse>(resp);
    },
    enabled: Boolean(apiToken),
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(() => listQuery.data?.items || [], [listQuery.data?.items]);
  const selected = useMemo(
    () => rows.find((p) => p.id === selectedId) || null,
    [rows, selectedId]
  );

  const deleteMutation = useMutation({
    mutationFn: async (post: PostRow) => {
      const resp = await fetch(`/api/users/${post.ownerId}/posts/${post.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ id: string; ownerId: string; deleted: true }>(resp);
    },
    onSuccess: (_, post) => {
      setPendingDelete(null);
      setSelectedId((current) => (current === post.id ? null : current));
      queryClient.invalidateQueries({ queryKey: ["posts", "list"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (compositeIds: string[]) =>
      Promise.all(
        compositeIds.map((composite) => {
          const [ownerId, postId] = composite.split(":");
          return fetch(`/api/users/${ownerId}/posts/${postId}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${apiToken}` },
          }).then((r) => readJson<{ id: string; ownerId: string; deleted: true }>(r));
        })
      ),
    onSuccess: () => {
      setSelectedIds([]);
      setSelectedId(null);
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["posts", "list"] });
    },
  });

  const columns = [
    {
      key: "thumb",
      label: "",
      render: (r: PostRow) => (
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-hover border border-border flex items-center justify-center">
          {r.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.imageUrl} alt={r.title} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted opacity-60" />
          )}
        </div>
      ),
    },
    {
      key: "title",
      label: "Post",
      render: (r: PostRow) => (
        <div className="max-w-[360px]">
          <p className="font-bold text-main truncate">{r.title}</p>
          <p className="text-[10px] text-muted font-medium truncate">{r.description || r.id}</p>
        </div>
      ),
    },
    {
      key: "author",
      label: "Author",
      render: (r: PostRow) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
            {r.authorPhotoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.authorPhotoURL} alt={r.authorName} className="w-full h-full object-cover" />
            ) : (
              getInitials(r.authorName)
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-main truncate">{r.authorName}</p>
            <p className="text-[10px] text-muted font-medium truncate">
              {r.authorUsername ? `@${r.authorUsername}` : r.authorEmail || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Posted",
      render: (r: PostRow) => (
        <span className="text-muted text-xs font-medium">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: PostRow) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete(r);
          }}
          className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete post"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (!apiToken) {
    return <AuthGate icon={FileText} title="Posts" subtitle="Moderate user-generated posts" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Posts</h1>
            <p className="text-sm text-muted font-medium italic">
              Browse, search by username, and delete user posts
            </p>
          </div>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={() => setBulkDeleteOpen(true)}
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
            searchPlaceholder="Search by username, name, email, or post title..."
          />
        </div>

        {listQuery.isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 mb-4">
            Failed to load posts: {listQuery.error.message}
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
            data={rows}
            currentPage={1}
            totalPages={1}
            totalItems={rows.length}
            pageSize={rows.length || itemsPerPage}
            onPageChange={() => {}}
            getId={(r) => `${r.ownerId}:${r.id}`}
            selectedItems={selectedIds}
            onToggleItem={(id) =>
              setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            onSelectAll={(ids) => setSelectedIds(ids)}
            onRowClick={(r) => setSelectedId(r.id)}
            emptyMessage="No posts found"
            emptyDescription={
              deferredSearch
                ? "No posts matched that search across the scanned window."
                : "Nothing to show yet — new posts will appear here."
            }
            loading={listQuery.isLoading}
          />
        </div>

        {listQuery.data && (
          <p className="px-8 pb-4 text-[10px] font-black uppercase tracking-widest text-muted opacity-60">
            Showing {rows.length} of {listQuery.data.total} matched
            {listQuery.data.scanned ? ` • scanned ${listQuery.data.scanned}` : ""}
          </p>
        )}
      </div>

      <DetailDrawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={selected ? `Post: ${selected.title}` : "Post"}
      >
        {!selected ? null : (
          <div className="space-y-8 p-1">
            {selected.imageUrl ? (
              <div className="w-full rounded-2xl overflow-hidden bg-background border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.imageUrl} alt={selected.title} className="w-full h-auto object-cover" />
              </div>
            ) : null}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Title</p>
              <p className="text-base font-bold text-main">{selected.title}</p>
            </div>

            {selected.description ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Description</p>
                <p className="text-sm text-main whitespace-pre-wrap break-words">{selected.description}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Author
                </p>
                <p className="text-sm font-bold text-main">{selected.authorName}</p>
                <p className="text-[11px] text-muted font-medium">
                  {selected.authorUsername ? `@${selected.authorUsername}` : selected.authorEmail || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Posted
                </p>
                <p className="text-sm font-medium">{formatDate(selected.createdAt)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Post ID
                </p>
                <p className="text-xs font-mono text-tertiary break-all">{selected.id}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Owner UID</p>
                <p className="text-xs font-mono text-tertiary break-all">{selected.ownerId}</p>
              </div>
            </div>

            {deleteMutation.isError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {deleteMutation.error.message}
              </div>
            ) : null}

            <button
              onClick={() => setPendingDelete(selected)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/5 text-red-300 border border-red-500/15 rounded-xl text-sm hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Post
            </button>
          </div>
        )}
      </DetailDrawer>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete post?"
        message={
          pendingDelete ? (
            <>
              This permanently removes <span className="font-bold text-main">{pendingDelete.title}</span> by{" "}
              <span className="font-bold text-main">{pendingDelete.authorName}</span>. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onCancel={() => {
          if (!deleteMutation.isPending) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) void deleteMutation.mutateAsync(pendingDelete);
        }}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Delete selected posts?"
        message={
          <>
            <strong className="text-main">{selectedIds.length}</strong> post{selectedIds.length === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.
          </>
        }
        confirmLabel={bulkDeleteMutation.isPending ? "Deleting…" : "Delete"}
        tone="danger"
        loading={bulkDeleteMutation.isPending}
        onCancel={() => {
          if (!bulkDeleteMutation.isPending) setBulkDeleteOpen(false);
        }}
        onConfirm={() => void bulkDeleteMutation.mutateAsync(selectedIds)}
      />
    </div>
  );
}
