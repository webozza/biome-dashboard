"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  CheckCircle,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { AccountType, VerificationRequest } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { readJson } from "@/lib/http";
import { formatDate } from "@/lib/format";
import { AuthGate } from "@/components/ui/auth-gate";

type VerificationListResponse = {
  
  items: VerificationRequest[];
  nextCursor: string | null;
};

type PatchPayload = Partial<Pick<VerificationRequest, "status" | "adminNote" | "rejectionReason" | "reviewedBy">>;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "Twitter",
  facebook: "Facebook",
};

async function fetchVerificationList({
  token,
  limit,
  cursor,
  status,
  platform,
}: {
  token: string;
  limit: number;
  cursor?: string;
  status?: string;
  platform?: string;
}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (status) params.set("status", status);
  if (platform) params.set("platform", platform);

  const resp = await fetch(`/api/verification?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return readJson<VerificationListResponse>(resp);
}

async function fetchVerification(id: string, token: string) {
  const resp = await fetch(`/api/verification/${id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return readJson<VerificationRequest>(resp);
}

async function patchVerification(id: string, patch: PatchPayload, token: string) {
  console.log("[verification][patch] payload", { id, patch });
  const resp = await fetch(`/api/verification/${id}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  return readJson<VerificationRequest>(resp);
}

async function removeVerification(id: string, token: string) {
  const resp = await fetch(`/api/verification/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  return readJson<{ id: string; deleted: true }>(resp);
}

type CreatePayload = {
  userName: string;
  email: string;
  socialAccount: string;
  platform: string;
  profileUrl: string | null;
  displayName: string | null;
  accountType: AccountType | null;
  verificationReason: string | null;
  activeOneYear: boolean | null;
  representsRealIdentity: boolean | null;
  screenshotUrl: string | null;
  agreementAccepted: boolean;
  followerCount: number | null;
  contentCategory: string | null;
  country: string | null;
  contactEmail: string | null;
};

async function createVerification(payload: CreatePayload, token: string) {
  const resp = await fetch(`/api/verification`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return readJson<{ id: string }>(resp);
}

const PLATFORM_OPTIONS = ["Instagram", "TikTok", "YouTube", "Twitter", "Facebook"] as const;

const EMPTY_CREATE_FORM = {
  userName: "",
  email: "",
  socialAccount: "",
  platforms: ["Instagram"] as string[],
  profileUrl: "",
  displayName: "",
  accountType: "personal" as AccountType,
  verificationReason: "",
  activeOneYear: "" as "" | "yes" | "no",
  representsRealIdentity: "" as "" | "yes" | "no",
  screenshotUrl: "",
  agreementAccepted: false,
  followerCount: "",
  contentCategory: "",
  country: "",
  contactEmail: "",
};

const NEUTRAL_FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-main outline-none transition-colors focus:border-white/20";
const BMID_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-2.5 py-1 font-mono text-xs font-black text-[#3b82f6] shadow-none";

function matchesSearch(item: VerificationRequest, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    item.id,
    item.userName,
    item.email,
    item.socialAccount,
    item.platform,
    item.reviewedBy || "",
    item.bmidNumber || "",
  ].some((value) => value.toLowerCase().includes(q));
}

function exportRows(rows: VerificationRequest[]) {
  if (rows.length === 0) return;
  const headers = [
    "id",
    "userName",
    "email",
    "platform",
    "socialAccount",
    "status",
    "reviewedBy",
    "createdAt",
    "updatedAt",
    "adminNote",
    "rejectionReason",
    "bmidNumber",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((key) => {
          const value = String(row[key as keyof VerificationRequest] ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `verification-page-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function VerificationPage() {
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
  const [pendingDelete, setPendingDelete] = useState<VerificationRequest | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [pageCursors, setPageCursors] = useState<Record<number, string | undefined>>({ 1: undefined });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [selectedUserOption, setSelectedUserOption] = useState<UserPickerOption | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const statusFilter = activeFilters.status && activeFilters.status !== "all" ? activeFilters.status : undefined;
  const platformFilter = activeFilters.platform && activeFilters.platform !== "all"
    ? PLATFORM_LABELS[activeFilters.platform] || activeFilters.platform
    : undefined;
  const currentCursor = currentPage > 1 ? pageCursors[currentPage] : undefined;

  const listQuery = useQuery({
    queryKey: ["verification", "list", { statusFilter, platformFilter, currentCursor, itemsPerPage }],
    queryFn: () =>
      fetchVerificationList({
        token: apiToken!,
        limit: itemsPerPage,
        cursor: currentCursor,
        status: statusFilter,
        platform: platformFilter,
      }),
    enabled: Boolean(apiToken) && (currentPage === 1 || Boolean(currentCursor)),
    placeholderData: (previousData) => previousData,
  });

  const visibleRows = useMemo(
    () => (listQuery.data?.items || []).filter((item) => matchesSearch(item, deferredSearchQuery)),
    [deferredSearchQuery, listQuery.data?.items]
  );

  const selectedFromList = useMemo(
    () => visibleRows.find((item) => item.id === selectedId) || listQuery.data?.items.find((item) => item.id === selectedId) || null,
    [listQuery.data?.items, selectedId, visibleRows]
  );

  const detailQuery = useQuery({
    queryKey: ["verification", "detail", selectedId],
    queryFn: () => fetchVerification(selectedId!, apiToken!),
    enabled: Boolean(selectedId && apiToken),
    initialData: selectedFromList || undefined,
  });

  const selected = detailQuery.data || selectedFromList;

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PatchPayload }) => patchVerification(id, patch, apiToken!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["verification", "detail", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["verification", "list"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({
      ids,
      patch,
    }: {
      ids: string[];
      patch: PatchPayload;
    }) => Promise.all(ids.map((id) => patchVerification(id, patch, apiToken!))),
    onSuccess: () => {
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["verification", "list"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["verification", "detail", selectedId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeVerification(id, apiToken!),
    onSuccess: (_, deletedId) => {
      clearSelection();
      setSelectedId((current) => (current === deletedId ? null : current));
      queryClient.removeQueries({ queryKey: ["verification", "detail", deletedId] });
      queryClient.invalidateQueries({ queryKey: ["verification", "list"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => removeVerification(id, apiToken!))),
    onSuccess: () => {
      clearSelection();
      setSelectedId(null);
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["verification", "list"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePayload) => createVerification(payload, apiToken!),
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setSelectedUserOption(null);
      queryClient.invalidateQueries({ queryKey: ["verification", "list"] });
    },
  });

  const isMutating = patchMutation.isPending || bulkMutation.isPending || deleteMutation.isPending;

  const columns = [
    {
      key: "id",
      label: "Request ID",
      render: (row: VerificationRequest) => <span className="font-mono text-xs text-tertiary">{row.id}</span>,
    },
    {
      key: "userName",
      label: "User",
      render: (row: VerificationRequest) => (
        <div>
          <p className="font-medium">{row.userName}</p>
          <p className="text-xs text-tertiary">{row.email}</p>
        </div>
      ),
    },
    { key: "platform", label: "Platform" },
    {
      key: "socialAccount",
      label: "Social Account",
      render: (row: VerificationRequest) => <span className="text-secondary">{row.socialAccount}</span>,
    },
    {
      key: "bmidNumber",
      label: "BMID",
      render: (row: VerificationRequest) =>
        row.status === "approved" && row.bmidNumber ? (
          <span className={BMID_BADGE_CLASS}>
            <ShieldCheck className="w-3.5 h-3.5 text-[#3b82f6]" />
            {row.bmidNumber}
          </span>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: VerificationRequest) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (row: VerificationRequest) => <span className="text-tertiary text-xs">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (row: VerificationRequest) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete(row);
          }}
          title="Delete verification request"
          className="p-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  async function handleStatusUpdate(status: VerificationRequest["status"]) {
    if (!selectedId) return;
    const patch: PatchPayload = {
      status,
      reviewedBy: user?.name || user?.email || "Admin",
      adminNote: adminNote.trim() || null,
    };
    if (status === "rejected") {
      patch.rejectionReason = rejectionReason.trim() || "Rejected by admin";
    }
    if (status === "approved" || status === "removed") {
      patch.rejectionReason = null;
    }
    await patchMutation.mutateAsync({ id: selectedId, patch });
  }

  async function handleBulkAction(status: "approved" | "rejected") {
    if (selectedItems.length === 0) return;
    const patch: PatchPayload = {
      status,
      reviewedBy: user?.name || user?.email || "Admin",
      adminNote:
        status === "approved"
          ? "Approved in bulk review"
          : "Rejected in bulk review",
      rejectionReason:
        status === "rejected" ? "Rejected in bulk review" : null,
    };
    await bulkMutation.mutateAsync({ ids: selectedItems, patch });
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

  function resetBackendPagination() {
    setSelectedId(null);
    clearSelection();
    setPageCursors({ 1: undefined });
    setPage(1);
  }

  function handleFilterChange(key: string, value: string) {
    resetBackendPagination();
    setFilter(key, value);
  }

  function handleClearFilterState() {
    resetBackendPagination();
    clearFilters();
  }

  function handleRowClick(row: VerificationRequest) {
    setSelectedId(row.id);
    setAdminNote(row.adminNote || "");
    setRejectionReason(row.rejectionReason || "");
  }

  async function handleCreateSubmit() {
    const trimmed = {
      userName: createForm.userName.trim(),
      email: createForm.email.trim(),
      socialAccount: createForm.socialAccount.trim(),
      profileUrl: createForm.profileUrl.trim(),
      displayName: createForm.displayName.trim(),
      verificationReason: createForm.verificationReason.trim(),
      screenshotUrl: createForm.screenshotUrl.trim(),
      contentCategory: createForm.contentCategory.trim(),
      country: createForm.country.trim(),
      contactEmail: createForm.contactEmail.trim(),
      followerCount: createForm.followerCount.trim(),
    };
    if (
      !trimmed.userName ||
      !trimmed.email ||
      !trimmed.socialAccount ||
      createForm.platforms.length === 0 ||
      !trimmed.profileUrl ||
      !trimmed.verificationReason ||
      !createForm.activeOneYear ||
      !createForm.representsRealIdentity ||
      !createForm.agreementAccepted
    ) {
      return;
    }
    const followerCountNumber = trimmed.followerCount ? Number(trimmed.followerCount) : null;
    const basePayload = {
      userName: trimmed.userName,
      email: trimmed.email,
      socialAccount: trimmed.socialAccount,
      profileUrl: trimmed.profileUrl,
      displayName: trimmed.displayName || null,
      accountType: createForm.accountType,
      verificationReason: trimmed.verificationReason,
      activeOneYear: createForm.activeOneYear === "yes",
      representsRealIdentity: createForm.representsRealIdentity === "yes",
      screenshotUrl: trimmed.screenshotUrl || null,
      agreementAccepted: createForm.agreementAccepted,
      followerCount: Number.isFinite(followerCountNumber) ? followerCountNumber : null,
      contentCategory: trimmed.contentCategory || null,
      country: trimmed.country || null,
      contactEmail: trimmed.contactEmail || null,
    };
    await Promise.all(
      createForm.platforms.map((platform) =>
        createMutation.mutateAsync({ ...basePayload, platform })
      )
    );
  }

  function handleSelectUser(userOption: UserPickerOption) {
    setSelectedUserOption(userOption);
    setCreateForm((current) => ({
      ...current,
      userName: userOption.displayName,
      email: userOption.email,
    }));
  }

  if (!apiToken) {
    return <AuthGate icon={ShieldCheck} title="Verification Requests" subtitle="Review and manage BMID verification requests" />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-main">Verification Requests</h1>
            <p className="text-sm font-medium italic text-muted">Review and manage BMID verification requests</p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search the current page by name, email, handle, or request ID..."
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "appealed", label: "Appealed" },
                { value: "removed", label: "Removed" },
              ],
            },
            {
              key: "platform",
              label: "Platform",
              options: [
                { value: "instagram", label: "Instagram" },
                { value: "tiktok", label: "TikTok" },
                { value: "youtube", label: "YouTube" },
                { value: "twitter", label: "Twitter" },
                { value: "facebook", label: "Facebook" },
              ],
            },
          ]}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilterState}
          selectedCount={selectedItems.length}
          onBulkApprove={() => void handleBulkAction("approved")}
          onBulkReject={() => void handleBulkAction("rejected")}
          onBulkDelete={() => setBulkDeleteOpen(true)}
          onExport={() => exportRows(visibleRows)}
        />

        {listQuery.isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            Failed to load verification requests: {listQuery.error.message}
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
            selectedItems={selectedItems}
            onToggleItem={toggleItem}
            onSelectAll={selectAll}
            getId={(row) => row.id}
            onRowClick={handleRowClick}
            emptyDescription="Change backend filters or search within the current result page."
            loading={listQuery.isLoading}
          />
        </div>
      </div>

      <DetailDrawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title="Verification Details"
        variant="modal"
        panelClassName="max-w-2xl"
      >
        {!selected ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-tertiary mb-1">Request ID</p>
              <p className="font-mono text-xs text-secondary break-all">{selected.id}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-tertiary mb-1">User</p>
                <p className="font-medium">{selected.userName}</p>
              </div>
              <div>
                <p className="text-xs text-tertiary mb-1">Email</p>
                <p className="text-sm">{selected.email}</p>
              </div>
              <div>
                <p className="text-xs text-tertiary mb-1">Platform</p>
                <p className="text-sm">{selected.platform}</p>
              </div>
              <div>
                <p className="text-xs text-tertiary mb-1">Social Account</p>
                <p className="text-sm">{selected.socialAccount}</p>
              </div>
              <div>
                <p className="text-xs text-tertiary mb-1">Status</p>
                <StatusBadge status={selected.status} />
              </div>
              {selected.status === "approved" && selected.bmidNumber && (
                <div>
                  <p className="text-xs text-tertiary mb-1">BMID Number</p>
                  <span className={`${BMID_BADGE_CLASS} text-sm`}>
                    <ShieldCheck className="w-4 h-4 text-[#3b82f6]" />
                    {selected.bmidNumber}
                  </span>
                </div>
              )}
              <div>
                <p className="text-xs text-tertiary mb-1">Submitted</p>
                <p className="text-sm">{formatDate(selected.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-tertiary mb-1">Reviewed By</p>
                <p className="text-sm">{selected.reviewedBy || "Pending review"}</p>
              </div>
              <div>
                <p className="text-xs text-tertiary mb-1">Last Updated</p>
                <p className="text-sm">{formatDate(selected.updatedAt)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Submitted Proofs</p>
              </div>

              {selected.profileUrl ? (
                <div>
                  <p className="text-xs text-tertiary mb-1">Profile / Channel URL</p>
                  <a
                    href={selected.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline-offset-2 hover:underline break-all"
                  >
                    {selected.profileUrl}
                  </a>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selected.displayName ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Display Name</p>
                    <p className="text-sm">{selected.displayName}</p>
                  </div>
                ) : null}
                {selected.accountType ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Account Type</p>
                    <p className="text-sm capitalize">{selected.accountType}</p>
                  </div>
                ) : null}
                {typeof selected.activeOneYear === "boolean" ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Active ≥ 1 year?</p>
                    <p className={`text-sm font-semibold ${selected.activeOneYear ? "text-primary" : "text-red-700 dark:text-red-300"}`}>
                      {selected.activeOneYear ? "Yes" : "No"}
                    </p>
                  </div>
                ) : null}
                {typeof selected.representsRealIdentity === "boolean" ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Real person/identity?</p>
                    <p className={`text-sm font-semibold ${selected.representsRealIdentity ? "text-primary" : "text-amber-700 dark:text-amber-300"}`}>
                      {selected.representsRealIdentity ? "Yes" : "No (entertainment/AI)"}
                    </p>
                  </div>
                ) : null}
                {typeof selected.followerCount === "number" ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Followers</p>
                    <p className="text-sm">{selected.followerCount.toLocaleString()}</p>
                  </div>
                ) : null}
                {selected.contentCategory ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Content Category</p>
                    <p className="text-sm">{selected.contentCategory}</p>
                  </div>
                ) : null}
                {selected.country ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Country</p>
                    <p className="text-sm">{selected.country}</p>
                  </div>
                ) : null}
                {selected.contactEmail ? (
                  <div>
                    <p className="text-xs text-tertiary mb-1">Contact Email</p>
                    <p className="text-sm break-all">{selected.contactEmail}</p>
                  </div>
                ) : null}
              </div>

              {selected.verificationReason ? (
                <div>
                  <p className="text-xs text-tertiary mb-1">Reason for Verification</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.verificationReason}</p>
                </div>
              ) : null}

              {selected.screenshotUrl ? (
                <div>
                  <p className="text-xs text-tertiary mb-1">Screenshot Proof</p>
                  <a
                    href={selected.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline-offset-2 hover:underline break-all"
                  >
                    {selected.screenshotUrl}
                  </a>
                </div>
              ) : null}

              {selected.agreementAccepted ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <CheckCircle className="w-3.5 h-3.5" />
                  User confirmed this is their real account.
                </div>
              ) : null}
            </div>

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

            <div className="space-y-2">
              <label className="block text-xs text-tertiary">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                disabled={isMutating}
                className={NEUTRAL_FIELD_CLASS}
                placeholder="Required when rejecting"
              />
            </div>

            {selected.adminNote && (
              <div className="p-3 bg-tertiary rounded-xl">
                <p className="text-xs text-tertiary mb-1">Saved Admin Note</p>
                <p className="text-sm">{selected.adminNote}</p>
              </div>
            )}

            {selected.rejectionReason && (
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <p className="text-xs text-red-400 mb-1">Saved Rejection Reason</p>
                <p className="text-sm text-red-300">{selected.rejectionReason}</p>
              </div>
            )}

            {(patchMutation.isError || deleteMutation.isError) && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {patchMutation.error?.message || deleteMutation.error?.message}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-2">
              {(selected.status === "pending" || selected.status === "appealed") && (
                <>
                  <button
                    onClick={() => void handleStatusUpdate("approved")}
                    disabled={isMutating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#059669]/10 text-[#059669] border border-[#059669]/20 rounded-xl text-sm font-bold hover:bg-[#059669]/15 transition-colors disabled:opacity-60"
                  >
                    {patchMutation.isPending && patchMutation.variables?.patch?.status === "approved" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => void handleStatusUpdate("rejected")}
                    disabled={isMutating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 rounded-xl text-sm font-bold hover:bg-[#ef4444]/15 transition-colors disabled:opacity-60"
                  >
                    {patchMutation.isPending && patchMutation.variables?.patch?.status === "rejected" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Reject
                  </button>
                </>
              )}
              {selected.status === "approved" && (
                <button
                  onClick={() => void handleStatusUpdate("removed")}
                  disabled={isMutating}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 rounded-xl text-sm font-bold hover:bg-[#f59e0b]/15 transition-colors disabled:opacity-60"
                >
                  {patchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                  Remove Verification
                </button>
              )}
            </div>

            <button
              onClick={() => void deleteMutation.mutateAsync(selected.id)}
              disabled={isMutating}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 rounded-xl text-sm font-bold hover:bg-[#ef4444]/15 transition-colors disabled:opacity-60"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
        title="New Verification"
        variant="modal"
        panelClassName="max-w-3xl"
      >
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">User</label>
            <UserPicker
              token={apiToken}
              value={selectedUserOption}
              onSelect={handleSelectUser}
              disabled={createMutation.isPending}
            />
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs text-tertiary">Platform *</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((opt) => {
                  const active = createForm.platforms.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={createMutation.isPending}
                      onClick={() =>
                        setCreateForm((f) => ({
                          ...f,
                          platforms: active
                            ? f.platforms.filter((p) => p !== opt)
                            : [...f.platforms, opt],
                        }))
                      }
                      className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                        active
                          ? "bg-[#059669]/10 border-[#059669]/20 text-[#059669]"
                          : "bg-transparent border-white/10 text-tertiary hover:border-white/20"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-tertiary">Select one or more — a separate verification request is created per platform.</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-tertiary">Social Account *</label>
              <input
                value={createForm.socialAccount}
                onChange={(e) => setCreateForm((f) => ({ ...f, socialAccount: e.target.value }))}
                disabled={createMutation.isPending}
                className={NEUTRAL_FIELD_CLASS}
                placeholder="@handle"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Profile / Channel URL *</label>
            <input
              value={createForm.profileUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, profileUrl: e.target.value }))}
              disabled={createMutation.isPending}
              className={NEUTRAL_FIELD_CLASS}
              placeholder="https://instagram.com/handle"
            />
            <p className="text-[11px] text-muted">Main proof — admin will open this link to verify the account.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs text-tertiary">Display Name</label>
              <input
                value={createForm.displayName}
                onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                disabled={createMutation.isPending}
                className={NEUTRAL_FIELD_CLASS}
                placeholder="Public name on the profile"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-tertiary">Account Type</label>
              <select
                value={createForm.accountType}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, accountType: e.target.value as AccountType }))
                }
                disabled={createMutation.isPending}
                className={NEUTRAL_FIELD_CLASS}
              >
                <option value="personal">Personal</option>
                <option value="creator">Creator</option>
                <option value="brand">Brand</option>
                <option value="entertainment">Entertainment</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Why are you requesting verification? *</label>
            <textarea
              value={createForm.verificationReason}
              onChange={(e) => setCreateForm((f) => ({ ...f, verificationReason: e.target.value }))}
              disabled={createMutation.isPending}
              rows={3}
              className={NEUTRAL_FIELD_CLASS}
              placeholder="Tell us why this account should be verified"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <label className="block text-xs text-tertiary">Active for at least 1 year? *</label>
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, activeOneYear: v }))}
                    disabled={createMutation.isPending}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      createForm.activeOneYear === v
                        ? "bg-[#059669]/10 border-[#059669]/20 text-[#059669]"
                        : "bg-transparent border-white/10 text-tertiary hover:border-white/20"
                    }`}
                  >
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <label className="block text-xs text-tertiary">Represents a real person/identity? *</label>
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, representsRealIdentity: v }))}
                    disabled={createMutation.isPending}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      createForm.representsRealIdentity === v
                        ? "bg-[#059669]/10 border-[#059669]/20 text-[#059669]"
                        : "bg-transparent border-white/10 text-tertiary hover:border-white/20"
                    }`}
                  >
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-tertiary">Screenshot Proof URL</label>
            <input
              value={createForm.screenshotUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, screenshotUrl: e.target.value }))}
              disabled={createMutation.isPending}
              className={NEUTRAL_FIELD_CLASS}
              placeholder="https://... (optional — profile screenshot, posting history, etc.)"
            />
          </div>

          <details className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-xs font-medium text-tertiary uppercase tracking-wider">
              Optional details
            </summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs text-tertiary">Follower Count</label>
                <input
                  type="number"
                  value={createForm.followerCount}
                  onChange={(e) => setCreateForm((f) => ({ ...f, followerCount: e.target.value }))}
                  disabled={createMutation.isPending}
                  className={NEUTRAL_FIELD_CLASS}
                  placeholder="12000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-tertiary">Main Content Category</label>
                <input
                  value={createForm.contentCategory}
                  onChange={(e) => setCreateForm((f) => ({ ...f, contentCategory: e.target.value }))}
                  disabled={createMutation.isPending}
                  className={NEUTRAL_FIELD_CLASS}
                  placeholder="Music, Fashion, Tech..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-tertiary">Country</label>
                <input
                  value={createForm.country}
                  onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
                  disabled={createMutation.isPending}
                  className={NEUTRAL_FIELD_CLASS}
                  placeholder="Bangladesh"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-tertiary">Contact Email</label>
                <input
                  type="email"
                  value={createForm.contactEmail}
                  onChange={(e) => setCreateForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  disabled={createMutation.isPending}
                  className={NEUTRAL_FIELD_CLASS}
                  placeholder="(if different from account email)"
                />
              </div>
            </div>
          </details>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={createForm.agreementAccepted}
              onChange={(e) => setCreateForm((f) => ({ ...f, agreementAccepted: e.target.checked }))}
              disabled={createMutation.isPending}
              className="mt-0.5 accent-emerald-500"
            />
            <span className="text-xs text-secondary leading-relaxed">
              I confirm this is my real social account and the information provided is correct. *
            </span>
          </label>

          {createMutation.isError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              {createMutation.error.message}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-2">
            <button
              onClick={() => {
                setCreateOpen(false);
                setCreateForm(EMPTY_CREATE_FORM);
                setSelectedUserOption(null);
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
                !createForm.userName.trim() ||
                !createForm.email.trim() ||
                !createForm.socialAccount.trim() ||
                !createForm.profileUrl.trim() ||
                !createForm.verificationReason.trim() ||
                !createForm.activeOneYear ||
                !createForm.representsRealIdentity ||
                !createForm.agreementAccepted
              }
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm hover:bg-primary/15 transition-colors disabled:opacity-60"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </div>
        </div>
      </DetailDrawer>

      <ConfirmModal
        open={!!pendingDelete}
        title={
          pendingDelete?.status === "approved"
            ? `Remove ${pendingDelete?.userName || "verified user"}?`
            : `Delete verification request?`
        }
        message={
          pendingDelete?.status === "approved" ? (
            <span>
              This deletes the verification record for <strong>{pendingDelete.userName}</strong>
              {pendingDelete.bmidNumber ? ` (${pendingDelete.bmidNumber})` : ""}. The user will lose
              their verified status and BMID number.
            </span>
          ) : (
            <span>
              This permanently deletes the verification request for{" "}
              <strong>{pendingDelete?.userName || "this user"}</strong>.
            </span>
          )
        }
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete"}
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteMutation.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Delete selected verifications?"
        message={
          <>
            <strong className="text-main">{selectedItems.length}</strong> verification{selectedItems.length === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.
          </>
        }
        confirmLabel={bulkDeleteMutation.isPending ? "Deleting…" : "Delete"}
        tone="danger"
        loading={bulkDeleteMutation.isPending}
        onCancel={() => {
          if (!bulkDeleteMutation.isPending) setBulkDeleteOpen(false);
        }}
        onConfirm={() => void bulkDeleteMutation.mutateAsync(selectedItems)}
      />
    </div>
  );
}
