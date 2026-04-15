"use client";

import { useState, useMemo } from "react";
import { Users, ShieldCheck, ShieldOff } from "lucide-react";
import { users, verificationRequests, contentRequests, boxRequests, type User } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export default function UsersPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, currentPage, setPage } = useDashboardStore();
  const [selected, setSelected] = useState<User | null>(null);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...users];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.bmidNumber && r.bmidNumber.toLowerCase().includes(q)));
    }
    if (activeFilters.verified && activeFilters.verified !== "all") {
      data = data.filter((r) => activeFilters.verified === "yes" ? r.verified : !r.verified);
    }
    return data;
  }, [searchQuery, activeFilters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getUserHistory = (userId: string) => {
    const verifs = verificationRequests.filter((v) => v.userId === userId);
    const contents = contentRequests.filter((c) => c.userId === userId);
    const boxes = boxRequests.filter((b) => b.userId === userId);
    return { verifs, contents, boxes };
  };

  const columns = [
    { key: "avatar", label: "", render: (r: User) => (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-emerald-500/10">
        {r.avatar}
      </div>
    )},
    { key: "name", label: "Name", render: (r: User) => (
      <div>
        <p className="font-bold text-main">{r.name}</p>
        <p className="text-[10px] text-muted font-medium">{r.email}</p>
      </div>
    )},
    { key: "bmidNumber", label: "BMID", render: (r: User) => r.bmidNumber ? <span className="font-mono text-xs font-semibold text-primary">{r.bmidNumber}</span> : <span className="text-xs text-muted">-</span> },
    { key: "verified", label: "Verified", render: (r: User) => (
      r.verified
        ? <span className="flex items-center gap-1.5 text-xs font-bold text-primary"><ShieldCheck className="w-4 h-4" /> YES</span>
        : <span className="flex items-center gap-1.5 text-xs font-bold text-muted"><ShieldOff className="w-4 h-4 opacity-50" /> NO</span>
    )},
    { key: "role", label: "Role", render: (r: User) => <span className="capitalize text-xs font-bold text-main px-2 py-0.5 bg-surface-hover rounded-md">{r.role}</span> },
    { key: "createdAt", label: "Joined", render: (r: User) => <span className="text-muted text-xs font-medium">{r.createdAt}</span> },
  ];

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
            searchPlaceholder="Search identities or BMIDs..."
            filters={[
              { key: "verified", label: "Verified", options: [
                { value: "yes", label: "Verified" },
                { value: "no", label: "Not Verified" },
              ]},
            ]}
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            onClearFilters={clearFilters}
            onExport={() => alert("Exporting user matching records...")}
          />
        </div>
        <DataTable columns={columns} data={paged} currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} getId={(r) => r.id} onRowClick={(r) => setSelected(r)} />
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={`Profile: ${selected?.name || ""}`}>
        {selected && (() => {
          const history = getUserHistory(selected.id);
          return (
            <div className="space-y-8 p-1">
              <div className="flex items-center gap-5 p-4 bg-background border border-border rounded-2xl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-emerald-500/10">
                  {selected.avatar}
                </div>
                <div>
                  <p className="font-extrabold text-2xl text-main">{selected.name}</p>
                  <p className="text-sm text-muted font-medium">{selected.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">BMID Identifier</p>
                  <p className="text-sm font-mono font-bold text-primary">{selected.bmidNumber || "NONE ASSIGNED"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Trust Status</p>
                  <StatusBadge status={selected.verified ? "approved" : "pending"} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">System Role</p>
                  <p className="text-sm font-bold capitalize text-main">{selected.role}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Registration Date</p>
                  <p className="text-sm font-medium">{selected.createdAt}</p>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-main border-b border-border pb-2">Activity History</h3>
                
                <HistorySection 
                  title="Verification History" 
                  count={history.verifs.length} 
                  items={history.verifs.map(v => ({ id: v.id, label: v.id, sub: v.createdAt, status: v.status }))} 
                />

                <HistorySection 
                  title="Content Activity" 
                  count={history.contents.length} 
                  items={history.contents.map(c => ({ id: c.id, label: c.postTitle, sub: c.createdAt, status: c.status }))} 
                />

                <HistorySection 
                  title="Box Logistics" 
                  count={history.boxes.length} 
                  items={history.boxes.map(b => ({ id: b.id, label: b.contentPreview, sub: `${b.platform} • ${b.createdAt}`, status: b.status }))} 
                />
              </div>
            </div>
          );
        })()}
      </DetailDrawer>
    </div>
  );
}

function HistorySection({ title, count, items }: { title: string; count: number; items: any[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{title}</p>
        <span className="text-[10px] font-bold bg-surface-hover px-2 py-0.5 rounded-full">{count}</span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="p-3 bg-background border border-border rounded-xl flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer group">
              <div>
                <p className="text-xs font-bold text-main group-hover:text-primary transition-colors">{item.label}</p>
                <p className="text-[10px] text-muted font-medium mt-0.5">{item.sub}</p>
              </div>
              <StatusBadge status={item.status} size="xs" />
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-muted italic p-3 bg-surface/30 rounded-xl border border-dashed border-border text-center">No historic records found</p>}
    </div>
  );
}
