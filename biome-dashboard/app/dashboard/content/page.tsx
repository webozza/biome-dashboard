"use client";

import { useState, useMemo } from "react";
import { FileText, CheckCircle, XCircle } from "lucide-react";
import { contentRequests, type ContentRequest } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export default function ContentPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, selectedItems, toggleItem, selectAll, clearSelection, currentPage, setPage } = useDashboardStore();
  const [selected, setSelected] = useState<ContentRequest | null>(null);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...contentRequests];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.userName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.postTitle.toLowerCase().includes(q) || r.bmidNumber.toLowerCase().includes(q));
    }
    if (activeFilters.status && activeFilters.status !== "all") data = data.filter((r) => r.status === activeFilters.status);
    return data;
  }, [searchQuery, activeFilters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    { key: "id", label: "ID", render: (r: ContentRequest) => <span className="font-mono text-[10px] text-muted">{r.id}</span> },
    { key: "userName", label: "User", render: (r: ContentRequest) => (
      <div>
        <p className="font-bold text-main">{r.userName}</p>
        <p className="text-[10px] text-muted font-medium">{r.bmidNumber}</p>
      </div>
    )},
    { key: "postTitle", label: "Post Title", render: (r: ContentRequest) => <span className="text-main font-medium">{r.postTitle}</span> },
    { key: "type", label: "Type", render: (r: ContentRequest) => <span className="uppercase text-[10px] font-bold text-muted bg-surface-hover px-2 py-0.5 rounded shadow-sm">{r.type}</span> },
    { key: "status", label: "Status", render: (r: ContentRequest) => <StatusBadge status={r.status} /> },
    { key: "createdAt", label: "Date", render: (r: ContentRequest) => <span className="text-muted text-xs font-medium">{r.createdAt}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Content Requests</h1>
            <p className="text-sm text-muted font-medium italic">Monitor post transfers and BMID assets</p>
          </div>
        </div>
      </div>

      <div className="card shadow-xl">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search content assets..."
            filters={[
              { key: "status", label: "Status", options: [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "in_review", label: "In Review" },
              ]},
            ]}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClearFilters={clearFilters}
            selectedCount={selectedItems.length}
            onBulkApprove={() => { alert("Bulk approve"); clearSelection(); }}
            onBulkReject={() => { alert("Bulk reject"); clearSelection(); }}
            onExport={() => alert("Exporting content registries...")}
          />
        </div>
        <DataTable columns={columns} data={paged} currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} selectedItems={selectedItems} onToggleItem={toggleItem} onSelectAll={selectAll} getId={(r) => r.id} onRowClick={(r) => setSelected(r)} />
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={`Content: ${selected?.id || ""}`}>
        {selected && (
          <div className="space-y-8 p-1">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Author</p>
                <p className="font-bold text-main">{selected.userName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">BMID</p>
                <p className="text-sm font-bold text-primary">{selected.bmidNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">State</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Submission</p>
                <p className="text-sm font-medium">{selected.createdAt}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Original Title</p>
              <p className="font-extrabold text-main text-lg leading-tight">{selected.postTitle}</p>
            </div>

            <div className="p-4 bg-background border border-border rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Content Extract</p>
              <p className="text-sm leading-relaxed text-main/80 italic">&ldquo;{selected.postPreview}&rdquo;</p>
            </div>

            {selected.adminNotes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">Admin Audit Trail</h3>
                <div className="space-y-3">
                  {selected.adminNotes.map((note, i) => (
                    <div key={i} className="p-4 bg-background border border-border rounded-xl shadow-sm">
                      <p className="text-sm leading-relaxed text-main">{note.note}</p>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
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
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all">
                    <CheckCircle className="w-4 h-4" /> Approve Transfer
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-500/20 text-red-500 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/5 transition-all">
                    <XCircle className="w-4 h-4" /> Decline
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
