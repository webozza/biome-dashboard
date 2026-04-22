"use client";

import { useMemo } from "react";
import { ScrollText } from "lucide-react";
import { auditLogs, type AuditLog } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export default function AuditPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, currentPage, setPage } = useDashboardStore();
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...auditLogs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.ownerUser.toLowerCase().includes(q) || r.requestId.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.taggedUser && r.taggedUser.toLowerCase().includes(q)));
    }
    if (activeFilters.status && activeFilters.status !== "all") data = data.filter((r) => r.status === activeFilters.status);
    if (activeFilters.type && activeFilters.type !== "all") data = data.filter((r) => r.requestType === activeFilters.type);
    if (activeFilters.source && activeFilters.source !== "all") data = data.filter((r) => r.source === activeFilters.source);
    return data;
  }, [searchQuery, activeFilters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    { key: "id", label: "Registry ID", render: (r: AuditLog) => <span className="font-mono text-[10px] text-muted font-bold tracking-tighter">{r.id}</span> },
    { key: "requestId", label: "Link Ref", render: (r: AuditLog) => <span className="font-mono text-[10px] bg-surface-hover px-1.5 py-0.5 rounded border border-border">{r.requestId}</span> },
    { key: "ownerUser", label: "Originator", render: (r: AuditLog) => <p className="font-bold text-main">{r.ownerUser}</p> },
    { key: "taggedUser", label: "Recipient", render: (r: AuditLog) => <p className="text-sm font-medium text-muted">{r.taggedUser || <span className="opacity-30">—</span>}</p> },
    { key: "requestType", label: "Class", render: (r: AuditLog) => <span className="uppercase text-[10px] font-black text-muted tracking-widest">{r.requestType}</span> },
    { key: "source", label: "Domain", render: (r: AuditLog) => <span className="uppercase text-[10px] font-black text-primary tracking-widest">{r.source}</span> },
    { key: "status", label: "Resolution", render: (r: AuditLog) => <StatusBadge status={r.status} /> },
    { key: "votes", label: "Consensus", render: (r: AuditLog) => (
      r.voteAccept + r.voteIgnore + r.voteRefuse > 0
        ? <div className="flex gap-1">
            <span className="text-[10px] font-bold text-emerald-500">{r.voteAccept}</span>
            <span className="text-[10px] font-bold text-muted">/</span>
            <span className="text-[10px] font-bold text-amber-500">{r.voteIgnore}</span>
            <span className="text-[10px] font-bold text-muted">/</span>
            <span className="text-[10px] font-bold text-red-500">{r.voteRefuse}</span>
          </div>
        : <span className="text-[10px] font-bold text-muted opacity-30">NO VOTES</span>
    )},
    { key: "updatedAt", label: "Finalized", render: (r: AuditLog) => <span className="text-muted text-[11px] font-bold tabular-nums">{r.updatedAt}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold shadow-sm">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Audit Ledger</h1>
            <p className="text-sm text-muted font-medium italic">Immutable history of all ecosystem transformations</p>
          </div>
        </div>
        <button 
          onClick={() => alert("Generating full audit report...")}
          className="px-5 py-2.5 bg-main text-surface text-[10px] font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-95"
        >
          Download XML Ledger
        </button>
      </div>

      <div className="card">
        <div className="mb-6">
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search identities, links, or registries..."
            filters={[
              { key: "status", label: "Status", options: [
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ]},
              { key: "type", label: "Type", options: [
                { value: "own", label: "Own" },
                { value: "duality", label: "Duality" },
              ]},
              { key: "source", label: "Source", options: [
                { value: "content", label: "Content" },
                { value: "box", label: "Box" },
              ]},
            ]}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClearFilters={clearFilters}
            onExport={() => alert("Exporting audit stream...")}
          />
        </div>
        <DataTable columns={columns} data={paged} currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} getId={(r) => r.id} />
      </div>
    </div>
  );
}
