"use client";

import { useState, useMemo } from "react";
import { Vote, CheckCircle, Eye, XCircle } from "lucide-react";
import { votingItems, type VotingItem } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { MetricCard } from "@/components/ui/metric-card";

export default function VotingPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, currentPage, setPage } = useDashboardStore();
  const [selected, setSelected] = useState<VotingItem | null>(null);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...votingItems];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.requestId.toLowerCase().includes(q));
    }
    if (activeFilters.status && activeFilters.status !== "all") data = data.filter((r) => r.status === activeFilters.status);
    if (activeFilters.type && activeFilters.type !== "all") data = data.filter((r) => r.requestType === activeFilters.type);
    return data;
  }, [searchQuery, activeFilters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    { key: "id", label: "ID", render: (r: VotingItem) => <span className="font-mono text-[10px] text-muted">{r.id}</span> },
    { key: "title", label: "Title", render: (r: VotingItem) => <span className="text-main font-medium">{r.title}</span> },
    { key: "requestType", label: "Type", render: (r: VotingItem) => <span className="uppercase text-[10px] font-bold text-muted bg-surface-hover px-2 py-0.5 rounded">{r.requestType}</span> },
    { key: "votes", label: "Tallies", render: (r: VotingItem) => (
      <div className="flex items-center gap-4 text-[10px] font-bold">
        <span className="text-primary">{r.accept} ACCEPT</span>
        <span className="text-amber-500">{r.ignore} IGNORE</span>
        <span className="text-red-500">{r.refuse} REFUSE</span>
      </div>
    )},
    { key: "status", label: "Status", render: (r: VotingItem) => <StatusBadge status={r.status} /> },
    { key: "outcome", label: "Outcome", render: (r: VotingItem) => r.outcome ? <StatusBadge status={r.outcome} /> : <span className="text-xs text-muted font-medium italic">Pending...</span> },
  ];

  const stats = [
    { label: "Accept Votes", value: votingItems.reduce((s, v) => s + v.accept, 0), icon: CheckCircle, trend: { value: "12%", isUp: true }, color: "var(--primary)" },
    { label: "Ignore Votes", value: votingItems.reduce((s, v) => s + v.ignore, 0), icon: Eye, trend: { value: "5%", isUp: true }, color: "#f59e0b" },
    { label: "Refuse Votes", value: votingItems.reduce((s, v) => s + v.refuse, 0), icon: XCircle, trend: { value: "2%", isUp: false }, color: "#ef4444" },
    { label: "Active Sessions", value: votingItems.filter((v) => v.status === "open").length, icon: Vote, trend: { value: "LIVE", isUp: true }, color: "#3b82f6" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <Vote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Voting Monitor</h1>
            <p className="text-sm text-muted font-medium italic">Decision making and consensus oversight</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <MetricCard key={i} title={s.label} value={s.value.toString()} trend={s.trend} icon={s.icon} color={s.color} />
        ))}
      </div>

      <div className="card shadow-xl">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search voting sessions..."
            filters={[
              { key: "status", label: "Status", options: [
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
                { value: "finalized", label: "Finalized" },
              ]},
              { key: "type", label: "Type", options: [
                { value: "content", label: "Content" },
                { value: "box", label: "Box" },
              ]},
            ]}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClearFilters={clearFilters}
            onExport={() => alert("Exporting community consensus data...")}
          />
        </div>
        <DataTable columns={columns} data={paged} currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} getId={(r) => r.id} onRowClick={(r) => setSelected(r)} />
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={`Tally: ${selected?.id || ""}`}>
        {selected && (
          <div className="space-y-8 p-1">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Proposal Title</p>
                <p className="font-bold text-main">{selected.title}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Impact Area</p>
                <p className="text-sm font-bold text-primary uppercase">{selected.requestType}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Session Status</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Consensus Outcome</p>
                {selected.outcome ? <StatusBadge status={selected.outcome} /> : <span className="text-sm font-bold text-muted italic">PENDING</span>}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Initiated</p>
                <p className="text-sm font-medium">{selected.openedAt}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Concluded</p>
                <p className="text-sm font-medium">{selected.closedAt || "ACTIVE SESSION"}</p>
              </div>
            </div>

            <div className="space-y-5 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">Vote Distribution</h3>
              <div className="space-y-5">
                {[
                  { label: "Accept", value: selected.accept, color: "var(--primary)" },
                  { label: "Ignore", value: selected.ignore, color: "#f59e0b" },
                  { label: "Refuse", value: selected.refuse, color: "#ef4444" },
                ].map((v) => {
                  const total = selected.accept + selected.ignore + selected.refuse;
                  const pct = total > 0 ? Math.round((v.value / total) * 100) : 0;
                  return (
                    <div key={v.label}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-main uppercase tracking-wide">{v.label}</span>
                        <span className="text-xs font-extrabold text-main">{v.value} <span className="text-[10px] text-muted font-bold">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-surface-hover rounded-full overflow-hidden border border-border/50 shadow-inner">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]" 
                          style={{ width: `${pct}%`, backgroundColor: v.color }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selected.status === "open" && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                  <Vote className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-primary">This voting session is currently live. Monitoring ecosystem sentiment in real-time.</p>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
