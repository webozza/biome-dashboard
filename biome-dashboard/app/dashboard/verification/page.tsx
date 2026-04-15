"use client";

import { useState, useMemo } from "react";
import { ShieldCheck, CheckCircle, XCircle, Undo2 } from "lucide-react";
import { verificationRequests, type VerificationRequest } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export default function VerificationPage() {
  const {
    searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters,
    selectedItems, toggleItem, selectAll, clearSelection, currentPage, setPage,
  } = useDashboardStore();
  const [selected, setSelected] = useState<VerificationRequest | null>(null);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...verificationRequests];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.userName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    }
    if (activeFilters.status && activeFilters.status !== "all") {
      data = data.filter((r) => r.status === activeFilters.status);
    }
    if (activeFilters.platform && activeFilters.platform !== "all") {
      data = data.filter((r) => r.platform.toLowerCase() === activeFilters.platform);
    }
    return data;
  }, [searchQuery, activeFilters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    { key: "id", label: "Request ID", render: (r: VerificationRequest) => <span className="font-mono text-xs text-tertiary">{r.id}</span> },
    {
      key: "userName", label: "User", render: (r: VerificationRequest) => (
        <div>
          <p className="font-medium">{r.userName}</p>
          <p className="text-xs text-tertiary">{r.email}</p>
        </div>
      )
    },
    { key: "platform", label: "Platform" },
    { key: "socialAccount", label: "Social Account", render: (r: VerificationRequest) => <span className="text-secondary">{r.socialAccount}</span> },
    { key: "status", label: "Status", render: (r: VerificationRequest) => <StatusBadge status={r.status} /> },
    { key: "createdAt", label: "Date", render: (r: VerificationRequest) => <span className="text-tertiary text-xs">{r.createdAt}</span> },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-bold">Verification Requests</h1>
          <p className="text-sm text-tertiary">Review and manage BMID verification requests</p>
        </div>
      </div>

      <div className="bg-card border border-primary rounded-2xl p-5">
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by name, email, or request ID..."
          filters={[
            {
              key: "status", label: "Status", options: [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "appealed", label: "Appealed" },
                { value: "removed", label: "Removed" },
              ]
            },
            {
              key: "platform", label: "Platform", options: [
                { value: "instagram", label: "Instagram" },
                { value: "tiktok", label: "TikTok" },
                { value: "youtube", label: "YouTube" },
                { value: "twitter", label: "Twitter" },
                { value: "facebook", label: "Facebook" },
              ]
            },
          ]}
          activeFilters={activeFilters}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
          selectedCount={selectedItems.length}
          onBulkApprove={() => { alert("Bulk approve " + selectedItems.length + " items"); clearSelection(); }}
          onBulkReject={() => { alert("Bulk reject " + selectedItems.length + " items"); clearSelection(); }}
          onExport={() => alert("Exporting verification requests...")}
        />

        <DataTable
          columns={columns}
          data={paged}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedItems={selectedItems}
          onToggleItem={toggleItem}
          onSelectAll={selectAll}
          getId={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
        />
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={`Verification: ${selected?.id || ""}`}>
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <p className="text-xs text-tertiary mb-1">Submitted</p>
                <p className="text-sm">{selected.createdAt}</p>
              </div>
            </div>

            {selected.adminNote && (
              <div className="p-3 bg-tertiary rounded-xl">
                <p className="text-xs text-tertiary mb-1">Admin Note</p>
                <p className="text-sm">{selected.adminNote}</p>
              </div>
            )}

            {selected.rejectionReason && (
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <p className="text-xs text-red-400 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-300">{selected.rejectionReason}</p>
              </div>
            )}

            <div className="p-4 bg-tertiary rounded-xl border border-primary">
              <p className="text-xs text-tertiary mb-2">Document Preview</p>
              <div className="h-32 bg-tertiary rounded-lg flex items-center justify-center text-tertiary text-sm">
                Identity document preview
              </div>
            </div>

            <div className="flex gap-2">
              {(selected.status === "pending" || selected.status === "appealed") && (
                <>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent/10 text-accent border border-accent/20 rounded-xl text-sm hover:bg-accent/20 transition-colors">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm hover:bg-red-500/20 transition-colors">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </>
              )}
              {selected.status === "approved" && (
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-sm hover:bg-amber-500/20 transition-colors">
                  <Undo2 className="w-4 h-4" /> Remove Verification
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
