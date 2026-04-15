"use client";

import { useState, useMemo } from "react";
import { GitBranch, CheckCircle, XCircle } from "lucide-react";
import { dualityRequests, type DualityRequest } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export default function DualityPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, currentPage, setPage } = useDashboardStore();
  const [selected, setSelected] = useState<DualityRequest | null>(null);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...dualityRequests];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.ownerName.toLowerCase().includes(q) || r.taggedUserName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    if (activeFilters.status && activeFilters.status !== "all") data = data.filter((r) => r.status === activeFilters.status);
    if (activeFilters.source && activeFilters.source !== "all") data = data.filter((r) => r.source === activeFilters.source);
    return data;
  }, [searchQuery, activeFilters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    { key: "id", label: "ID", render: (r: DualityRequest) => <span className="font-mono text-[10px] text-muted">{r.id}</span> },
    { key: "ownerName", label: "Registry Owner", render: (r: DualityRequest) => <span className="font-bold text-main">{r.ownerName}</span> },
    { key: "taggedUserName", label: "Joint User", render: (r: DualityRequest) => (
      <div>
        <p className="font-bold text-main">{r.taggedUserName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted font-bold uppercase tracking-tight">Status:</span>
          <StatusBadge status={r.taggedUserAction} />
        </div>
      </div>
    )},
    { key: "source", label: "Origin", render: (r: DualityRequest) => <span className="uppercase text-[10px] font-bold text-muted bg-surface-hover px-2 py-0.5 rounded shadow-sm">{r.source}</span> },
    { key: "status", label: "State", render: (r: DualityRequest) => <StatusBadge status={r.status} /> },
    { key: "createdAt", label: "Date", render: (r: DualityRequest) => <span className="text-muted text-xs font-medium">{r.createdAt}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Duality Requests</h1>
            <p className="text-sm text-muted font-medium italic">Monitor joint asset ownership and tagging requests</p>
          </div>
        </div>
      </div>

      <div className="card shadow-xl">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search owners or tagged identities..."
            filters={[
              { key: "status", label: "Status", options: [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "waiting_tagged", label: "Waiting Tagged" },
              ]},
              { key: "source", label: "Source", options: [
                { value: "content", label: "Content" },
                { value: "box", label: "Box" },
              ]},
            ]}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClearFilters={clearFilters}
            onExport={() => alert("Exporting duality registers...")}
          />
        </div>
        <DataTable columns={columns} data={paged} currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} getId={(r) => r.id} onRowClick={(r) => setSelected(r)} />
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={`Duality Case: ${selected?.id || ""}`}>
        {selected && (
          <div className="space-y-8 p-1">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Primary Owner</p>
                <p className="font-bold text-main">{selected.ownerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Associated Peer</p>
                <p className="font-bold text-main">{selected.taggedUserName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Peer Engagement</p>
                <StatusBadge status={selected.taggedUserAction} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Asset Source</p>
                <p className="text-sm font-bold text-primary uppercase">{selected.source}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Current State</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Initiated</p>
                <p className="text-sm font-medium">{selected.createdAt}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">Administrative Actions</h3>
              <div className="space-y-3">
                {selected.decisionHistory.map((d, i) => (
                  <div key={i} className="p-4 bg-background border border-border rounded-xl shadow-sm">
                    <p className="text-sm font-bold text-main">{d.action}</p>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                       <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {d.by.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wide">
                        {d.by} <span className="mx-1 opacity-30">•</span> {d.at}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">Event Timeline</h3>
              <div className="space-y-0 relative ml-4">
                <div className="absolute left-[-16px] top-2 bottom-2 w-0.5 bg-border" />
                {selected.timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-4 py-3 relative">
                    <div className="absolute left-[-20px] top-[14px] w-2.5 h-2.5 rounded-full bg-white border-2 border-primary z-10 shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-main">{t.event}</p>
                      <p className="text-[10px] text-muted font-medium mt-0.5">{t.at}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(selected.status === "pending" || selected.status === "waiting_tagged") && (
              <div className="flex gap-3 pt-4">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all active:scale-95">
                  <CheckCircle className="w-4 h-4" /> Grant Approval
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-500/20 text-red-500 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/5 transition-all active:scale-95">
                  <XCircle className="w-4 h-4" /> Decline Registry
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
