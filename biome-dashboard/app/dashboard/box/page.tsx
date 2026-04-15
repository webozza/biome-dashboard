"use client";

import { useState, useMemo } from "react";
import { Box, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { boxRequests, type BoxRequest } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

const platformColors: Record<string, string> = {
  tiktok: "bg-black text-white",
  instagram: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  youtube: "bg-red-500/10 text-red-500 border-red-500/20",
  facebook: "bg-blue-600/10 text-blue-600 border-blue-600/20",
  twitter: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  other: "bg-surface-hover text-muted border-border",
};

export default function BoxPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, selectedItems, toggleItem, selectAll, clearSelection, currentPage, setPage } = useDashboardStore();
  const [selected, setSelected] = useState<BoxRequest | null>(null);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...boxRequests];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.userName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.bmidNumber.toLowerCase().includes(q));
    }
    if (activeFilters.status && activeFilters.status !== "all") data = data.filter((r) => r.status === activeFilters.status);
    if (activeFilters.platform && activeFilters.platform !== "all") data = data.filter((r) => r.platform === activeFilters.platform);
    return data;
  }, [searchQuery, activeFilters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    { key: "id", label: "ID", render: (r: BoxRequest) => <span className="font-mono text-[10px] text-muted font-bold">{r.id}</span> },
    { key: "userName", label: "User Identity", render: (r: BoxRequest) => (
      <div>
        <p className="font-bold text-main">{r.userName}</p>
        <p className="text-[10px] text-muted font-bold tracking-tight">{r.bmidNumber}</p>
      </div>
    )},
    { key: "platform", label: "Social Origin", render: (r: BoxRequest) => (
      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${platformColors[r.platform] || platformColors.other}`}>
        {r.platform}
      </span>
    )},
    { key: "contentPreview", label: "Snapshot", render: (r: BoxRequest) => <span className="text-muted text-sm truncate max-w-[200px] block font-medium italic">"{r.contentPreview}"</span> },
    { key: "status", label: "State", render: (r: BoxRequest) => <StatusBadge status={r.status} /> },
    { key: "createdAt", label: "Date", render: (r: BoxRequest) => <span className="text-muted text-xs font-medium">{r.createdAt}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold shadow-sm">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Box Requests</h1>
            <p className="text-sm text-muted font-medium italic">Monitor external content submission and alignment</p>
          </div>
        </div>
      </div>

      <div className="card shadow-xl">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search identities or BMID numbers..."
            filters={[
              { key: "status", label: "Status", options: [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "in_review", label: "In Review" },
              ]},
              { key: "platform", label: "Platform", options: [
                { value: "tiktok", label: "TikTok" },
                { value: "instagram", label: "Instagram" },
                { value: "youtube", label: "YouTube" },
                { value: "facebook", label: "Facebook" },
              ]},
            ]}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClearFilters={clearFilters}
            selectedCount={selectedItems.length}
            onBulkApprove={() => { alert("Bulk approve"); clearSelection(); }}
            onBulkReject={() => { alert("Bulk reject"); clearSelection(); }}
            onExport={() => alert("Exporting box registers...")}
          />
        </div>
        <DataTable columns={columns} data={paged} currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} selectedItems={selectedItems} onToggleItem={toggleItem} onSelectAll={selectAll} getId={(r) => r.id} onRowClick={(r) => setSelected(r)} />
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={`Box Transmission: ${selected?.id || ""}`}>
        {selected && (
          <div className="space-y-8 p-1">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">User Identity</p>
                <p className="font-bold text-main">{selected.userName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">BMID Credential</p>
                <p className="text-sm font-bold text-main">{selected.bmidNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Platform Source</p>
                <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${platformColors[selected.platform]}`}>{selected.platform}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Current State</p>
                <StatusBadge status={selected.status} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Shared Linkage</p>
              <div className="p-3 bg-surface rounded-xl border border-border group cursor-pointer hover:border-primary/50 transition-colors">
                <a className="text-sm text-primary font-bold flex items-center gap-2 break-all overflow-hidden">
                  {selected.sharedUrl} <ExternalLink className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>
            </div>

            <div className="p-4 bg-background border border-primary/20 rounded-2xl shadow-inner shadow-primary/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Narrative Content</p>
              <p className="text-sm text-main font-medium leading-relaxed italic">"{selected.contentPreview}"</p>
            </div>

            {selected.adminNotes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">Administrative Ledger</h3>
                <div className="space-y-3">
                  {selected.adminNotes.map((note, i) => (
                    <div key={i} className="p-4 bg-background border border-border rounded-xl shadow-sm">
                      <p className="text-sm font-bold text-main">{note.note}</p>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {note.by.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-wide">
                          {note.by} <span className="mx-1 opacity-30">•</span> {note.at}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {(selected.status === "pending" || selected.status === "in_review") && (
                <>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all active:scale-95">
                    <CheckCircle className="w-4 h-4" /> Finalize Approval
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-500/20 text-red-500 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/5 transition-all active:scale-95">
                    <XCircle className="w-4 h-4" /> Decline Box Request
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
