"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Users,
  ShieldCheck,
  ShieldOff,
  Loader2,
  LogIn,
  Mail,
  Calendar,
  Hash,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useAuthStore } from "@/lib/stores/auth-store";

type UserDoc = {
  id: string;
  name: string;
  email: string;
  bmidNumber: string | null;
  verified: boolean;
  role: string;
  avatar?: string;
  photoURL?: string | null;
  createdAt: string;
  updatedAt?: string;
  displayName?: string;
  userName?: string;
  username?: string;
  handle?: string;
};

type UserListResponse = {
  items: UserDoc[];
  nextCursor: string | null;
};

type VerificationDoc = {
  id: string;
  userId: string;
  status: string;
  platform: string;
  socialAccount: string;
  createdAt: string;
};

type ContentDoc = {
  id: string;
  userId: string;
  postTitle: string;
  status: string;
  type: string;
  createdAt: string;
};

async function readJson<T>(resp: Response): Promise<T> {
  const data = (await resp.json().catch(() => null)) as T & { error?: string };
  if (!resp.ok) throw new Error((data as { error?: string })?.error || "request_failed");
  return data;
}

function formatDate(value: unknown) {
  const normalized =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
        ? value.toDate()
        : value;

  const date = normalized instanceof Date ? normalized : new Date(String(normalized ?? ""));
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function UsersPage() {
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
  const [pageCursors, setPageCursors] = useState<Record<number, string | undefined>>({ 1: undefined });
  const deferredSearch = useDeferredValue(searchQuery.trim());

  const verifiedFilter =
    activeFilters.verified && activeFilters.verified !== "all" ? activeFilters.verified : undefined;
  const currentCursor = currentPage > 1 ? pageCursors[currentPage] : undefined;

  const listQuery = useQuery({
    queryKey: ["users", "list", { verifiedFilter, currentCursor, itemsPerPage, deferredSearch }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(itemsPerPage) });
      if (currentCursor && !deferredSearch) params.set("cursor", currentCursor);
      if (verifiedFilter) params.set("verified", verifiedFilter === "yes" ? "true" : "false");
      if (deferredSearch) params.set("q", deferredSearch);
      const resp = await fetch(`/api/users?${params}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<UserListResponse>(resp);
    },
    enabled: Boolean(apiToken) && (currentPage === 1 || Boolean(currentCursor) || Boolean(deferredSearch)),
    placeholderData: (prev) => prev,
  });

  const visibleRows = useMemo(() => {
    return listQuery.data?.items || [];
  }, [listQuery.data?.items]);

  const selected = useMemo(
    () => visibleRows.find((u) => u.id === selectedId) || listQuery.data?.items.find((u) => u.id === selectedId) || null,
    [visibleRows, selectedId, listQuery.data?.items]
  );

  // Fetch verification & content history for selected user
  const historyQuery = useQuery({
    queryKey: ["users", "history", selectedId],
    queryFn: async () => {
      const [verifs, contents] = await Promise.all([
        fetch(`/api/verification?userId=${selectedId}&limit=50`, {
          headers: { authorization: `Bearer ${apiToken}` },
        }).then((r) => readJson<{ items: VerificationDoc[] }>(r)),
        fetch(`/api/content?userId=${selectedId}&limit=50`, {
          headers: { authorization: `Bearer ${apiToken}` },
        }).then((r) => readJson<{ items: ContentDoc[] }>(r)),
      ]);
      return { verifs: verifs.items, contents: contents.items };
    },
    enabled: Boolean(selectedId && apiToken),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ id: string; deleted: true }>(resp);
    },
    onSuccess: (_, deletedId) => {
      setSelectedId((current) => (current === deletedId ? null : current));
      queryClient.removeQueries({ queryKey: ["users", "history", deletedId] });
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });

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

  function handleFilterChange(key: string, value: string) {
    setSelectedId(null);
    setPageCursors({ 1: undefined });
    setPage(1);
    setFilter(key, value);
  }

  function handleClearFilters() {
    setSelectedId(null);
    setPageCursors({ 1: undefined });
    setPage(1);
    clearFilters();
  }

  const columns = [
    {
      key: "avatar",
      label: "",
      render: (r: UserDoc) => (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-emerald-500/10 overflow-hidden">
          {r.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.photoURL} alt={r.name} className="w-full h-full object-cover" />
          ) : (
            r.avatar || getInitials(r.name || "?")
          )}
        </div>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (r: UserDoc) => (
        <div>
          <p className="font-bold text-main">{r.name || r.displayName || "—"}</p>
          <p className="text-[10px] text-muted font-medium">{r.email}</p>
        </div>
      ),
    },
    {
      key: "bmidNumber",
      label: "BMID",
      render: (r: UserDoc) =>
        r.bmidNumber ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-semibold">
            <ShieldCheck className="w-3 h-3" />
            {r.bmidNumber}
          </span>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    {
      key: "verified",
      label: "Verified",
      render: (r: UserDoc) =>
        r.verified ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <ShieldCheck className="w-4 h-4" /> YES
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
            <ShieldOff className="w-4 h-4 opacity-50" /> NO
          </span>
        ),
    },
    {
      key: "role",
      label: "Role",
      render: (r: UserDoc) => (
        <span className="capitalize text-xs font-bold text-main px-2 py-0.5 bg-surface-hover rounded-md">
          {r.role || "user"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Joined",
      render: (r: UserDoc) => (
        <span className="text-muted text-xs font-medium">{formatDate(r.createdAt)}</span>
      ),
    },
  ];

  if (!apiToken) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">User Profiles</h1>
            <p className="text-sm text-muted font-medium italic">Directory of all ecosystem participants</p>
          </div>
        </div>
        <div className="card p-8 flex flex-col items-center gap-4">
          <LogIn className="w-8 h-8 text-amber-400" />
          <p className="text-sm text-amber-300 font-semibold">Sign in to view users</p>
          <a
            href="/login"
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">User Profiles</h1>
            <p className="text-sm text-muted font-medium italic">Directory of all ecosystem participants</p>
          </div>
        </div>
      </div>

      <div className="card shadow-xl">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search all users by name, email, handle, or BMID..."
            filters={[
              {
                key: "verified",
                label: "Verified",
                options: [
                  { value: "yes", label: "Verified" },
                  { value: "no", label: "Not Verified" },
                ],
              },
            ]}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        </div>

        {listQuery.isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 mb-4">
            Failed to load users: {listQuery.error.message}
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
            onRowClick={(r) => setSelectedId(r.id)}
            emptyDescription={deferredSearch ? "No users matched the current backend search." : "Change filters to load a different user segment."}
          />
        </div>
      </div>

      <DetailDrawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={`Profile: ${selected?.name || ""}`}
      >
        {!selected ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-8 p-1">
            <div className="flex items-center gap-5 p-4 bg-background border border-border rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-emerald-500/10 overflow-hidden">
                {selected.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.photoURL} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  selected.avatar || getInitials(selected.name || "?")
                )}
              </div>
              <div>
                <p className="font-extrabold text-2xl text-main">{selected.name}</p>
                <p className="text-sm text-muted font-medium">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> BMID Identifier
                </p>
                {selected.bmidNumber ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-mono font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {selected.bmidNumber}
                  </span>
                ) : (
                  <p className="text-sm font-mono font-bold text-muted">NONE ASSIGNED</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Trust Status</p>
                <StatusBadge status={selected.verified ? "approved" : "pending"} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">System Role</p>
                <p className="text-sm font-bold capitalize text-main">{selected.role || "user"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Registration Date
                </p>
                <p className="text-sm font-medium">{formatDate(selected.createdAt)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </p>
                <p className="text-sm font-medium break-all">{selected.email}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">User ID</p>
                <p className="text-xs font-mono text-tertiary break-all">{selected.id}</p>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">
                Activity History
              </h3>

              {historyQuery.isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-xs">Loading history...</span>
                </div>
              ) : (
                <>
                  <HistorySection
                    title="Verification History"
                    count={historyQuery.data?.verifs.length || 0}
                    items={(historyQuery.data?.verifs || []).map((v) => ({
                      id: v.id,
                      label: `${v.platform} - ${v.socialAccount}`,
                      sub: formatDate(v.createdAt),
                      status: v.status,
                    }))}
                  />
                  <HistorySection
                    title="Content Activity"
                    count={historyQuery.data?.contents.length || 0}
                    items={(historyQuery.data?.contents || []).map((c) => ({
                      id: c.id,
                      label: c.postTitle,
                      sub: `${c.type} - ${formatDate(c.createdAt)}`,
                      status: c.status,
                    }))}
                  />
                </>
              )}
            </div>

            {deleteMutation.isError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {deleteMutation.error.message}
              </div>
            ) : null}

            <button
              onClick={() => void deleteMutation.mutateAsync(selected.id)}
              disabled={deleteMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/5 text-red-300 border border-red-500/15 rounded-xl text-sm hover:bg-red-500/10 transition-colors disabled:opacity-60"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete User
            </button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function HistorySection({
  title,
  count,
  items,
}: {
  title: string;
  count: number;
  items: { id: string; label: string; sub: string; status: string }[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</p>
        <span className="text-[10px] font-bold bg-surface-hover px-2 py-0.5 rounded-full">{count}</span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-background border border-border rounded-xl flex items-center justify-between hover:bg-surface-hover transition-colors group"
            >
              <div>
                <p className="text-xs font-bold text-main group-hover:text-primary transition-colors">
                  {item.label}
                </p>
                <p className="text-[10px] text-muted font-medium mt-0.5">{item.sub}</p>
              </div>
              <StatusBadge status={item.status} size="xs" />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted italic p-3 bg-surface/30 rounded-xl border border-dashed border-border text-center">
          No historic records found
        </p>
      )}
    </div>
  );
}
