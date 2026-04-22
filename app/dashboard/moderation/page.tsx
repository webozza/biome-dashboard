"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Eye, CheckCircle, ShieldAlert, UserX, Flag, Trash2, XCircle } from "lucide-react";
import { flaggedItems, postReports, blockedUsers, type FlaggedItem, type PostReport, type BlockedUser } from "@/lib/data/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

type TabType = "flagged" | "reports" | "blocked";

export default function ModerationPage() {
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, currentPage, setPage } = useDashboardStore();
  const [activeTab, setActiveTab] = useState<TabType>("flagged");
  const [selectedFlagged, setSelectedFlagged] = useState<FlaggedItem | null>(null);
  const [selectedReport, setSelectedReport] = useState<PostReport | null>(null);
  const [selectedBlocked, setSelectedBlocked] = useState<BlockedUser | null>(null);
  
  const itemsPerPage = 10;

  // Filtered data based on active tab
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    
    if (activeTab === "flagged") {
      let data = [...flaggedItems];
      if (searchQuery) data = data.filter((r) => r.description.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
      if (activeFilters.severity && activeFilters.severity !== "all") data = data.filter((r) => r.severity === activeFilters.severity);
      if (activeFilters.type && activeFilters.type !== "all") data = data.filter((r) => r.type === activeFilters.type);
      if (activeFilters.status && activeFilters.status !== "all") data = data.filter((r) => r.status === activeFilters.status);
      return data;
    } else if (activeTab === "reports") {
      let data = [...postReports];
      if (searchQuery) data = data.filter((r) => r.postTitle.toLowerCase().includes(q) || r.reporterName.toLowerCase().includes(q));
      if (activeFilters.reason && activeFilters.reason !== "all") data = data.filter((r) => r.reason === activeFilters.reason);
      if (activeFilters.status && activeFilters.status !== "all") data = data.filter((r) => r.status === activeFilters.status);
      return data;
    } else {
      let data = [...blockedUsers];
      if (searchQuery) data = data.filter((r) => r.userName.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q));
      return data;
    }
  }, [activeTab, searchQuery, activeFilters]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const pagedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const flaggedColumns = [
    { key: "id", label: "ID", render: (r: FlaggedItem) => <span className="font-mono text-[10px] text-muted">{r.id}</span> },
    { key: "type", label: "Type", render: (r: FlaggedItem) => <span className="capitalize text-[10px] font-bold text-main px-2 py-0.5 bg-surface-hover rounded shadow-sm">{r.type}</span> },
    { key: "description", label: "Description", render: (r: FlaggedItem) => <span className="text-main font-medium text-sm truncate max-w-[300px]">{r.description}</span> },
    { key: "severity", label: "Severity", render: (r: FlaggedItem) => <StatusBadge status={r.severity} /> },
    { key: "status", label: "Status", render: (r: FlaggedItem) => <StatusBadge status={r.status} /> },
    { key: "flaggedAt", label: "Date", render: (r: FlaggedItem) => <span className="text-muted text-xs font-medium">{r.flaggedAt}</span> },
  ];

  const reportColumns = [
    { key: "id", label: "ID", render: (r: PostReport) => <span className="font-mono text-[10px] text-muted">{r.id}</span> },
    { key: "postTitle", label: "Post", render: (r: PostReport) => <span className="text-main font-medium">{r.postTitle}</span> },
    { key: "reporterName", label: "Reporter", render: (r: PostReport) => (
      <div className="flex items-center gap-2 text-main font-bold">
        <div className="w-5 h-5 rounded-full bg-surface-hover flex items-center justify-center text-[10px]">{r.reporterName.charAt(0)}</div>
        {r.reporterName}
      </div>
    )},
    { key: "reason", label: "Reason", render: (r: PostReport) => <span className="capitalize text-xs font-bold text-muted bg-surface-hover px-2 py-0.5 rounded">{r.reason}</span> },
    { key: "status", label: "Status", render: (r: PostReport) => <StatusBadge status={r.status} /> },
    { key: "createdAt", label: "Date", render: (r: PostReport) => <span className="text-muted text-xs font-medium">{r.createdAt}</span> },
  ];

  const blockedColumns = [
    { key: "userId", label: "User ID", render: (r: BlockedUser) => <span className="font-mono text-[10px] text-muted">{r.userId}</span> },
    { key: "userName", label: "User Name", render: (r: BlockedUser) => <span className="text-main font-bold">{r.userName}</span> },
    { key: "reason", label: "Reason", render: (r: BlockedUser) => <span className="text-muted text-sm italic">&ldquo;{r.reason}&rdquo;</span> },
    { key: "blockedBy", label: "Blocked By", render: (r: BlockedUser) => <span className="text-xs font-bold text-primary">{r.blockedBy.toUpperCase()}</span> },
    { key: "blockedAt", label: "Date", render: (r: BlockedUser) => <span className="text-muted text-xs font-medium">{r.blockedAt}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-main">Safety & Moderation</h1>
            <p className="text-sm text-muted font-medium italic">Monitor ecosystem health and enforce policies</p>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden lg:flex gap-1 p-1 bg-surface-hover/50 border border-border rounded-xl">
          {(["flagged", "reports", "blocked"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                activeTab === tab ? "bg-surface text-primary shadow-sm ring-1 ring-border" : "text-muted hover:text-main"
              }`}
            >
              {tab} ({tab === "flagged" ? flaggedItems.length : tab === "reports" ? postReports.length : blockedUsers.length})
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-6">
          {activeTab === "flagged" && (
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search flagged records..."
              filters={[
                { key: "severity", label: "Severity", options: [
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ]},
                { key: "type", label: "Type", options: [
                  { value: "user", label: "User" },
                  { value: "link", label: "Link" },
                  { value: "voting", label: "Voting" },
                  { value: "content", label: "Content" },
                ]},
                { key: "status", label: "Status", options: [
                  { value: "open", label: "Open" },
                  { value: "reviewed", label: "Reviewed" },
                  { value: "resolved", label: "Resolved" },
                ]},
              ]}
              activeFilters={activeFilters}
              onFilterChange={setFilter}
              onClearFilters={clearFilters}
            />
          )}
          
          {activeTab === "reports" && (
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search user reports..."
              filters={[
                { key: "reason", label: "Reason", options: [
                  { value: "spam", label: "Spam" },
                  { value: "inappropriate", label: "Inappropriate" },
                  { value: "harassment", label: "Harassment" },
                  { value: "copyright", label: "Copyright" },
                ]},
                { key: "status", label: "Status", options: [
                  { value: "pending", label: "Pending" },
                  { value: "reviewed", label: "Reviewed" },
                  { value: "actioned", label: "Actioned" },
                  { value: "dismissed", label: "Dismissed" },
                ]},
              ]}
              activeFilters={activeFilters}
              onFilterChange={setFilter}
              onClearFilters={clearFilters}
            />
          )}

          {activeTab === "blocked" && (
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search restricted accounts..."
              filters={[]}
              activeFilters={activeFilters}
              onFilterChange={setFilter}
              onClearFilters={clearFilters}
            />
          )}
        </div>

        <DataTable 
          columns={(activeTab === "flagged" ? flaggedColumns : activeTab === "reports" ? reportColumns : blockedColumns) as any} 
          data={pagedData as any} 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={setPage} 
          getId={(r: any) => r.id || r.userId} 
          onRowClick={(r: any) => {
            if (activeTab === "flagged") setSelectedFlagged(r);
            else if (activeTab === "reports") setSelectedReport(r);
            else setSelectedBlocked(r);
          }} 
        />
      </div>

      {/* Flagged Detail Drawer */}
      <DetailDrawer open={!!selectedFlagged} onClose={() => setSelectedFlagged(null)} title={`Incident: ${selectedFlagged?.id || ""}`}>
        {selectedFlagged && (
          <div className="space-y-8 p-1">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Asset Category</p>
                <p className="font-extrabold text-main capitalize">{selectedFlagged.type}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Criticality</p>
                <StatusBadge status={selectedFlagged.severity} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Status</p>
                <StatusBadge status={selectedFlagged.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Occurrence</p>
                <p className="text-sm font-medium">{selectedFlagged.flaggedAt}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Internal Reference</p>
                <p className="text-sm font-mono font-bold text-primary px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">{selectedFlagged.relatedId}</p>
              </div>
            </div>

            <div className="p-4 bg-background border border-border rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Violation Details</p>
              <p className="text-sm leading-relaxed text-main">{selectedFlagged.description}</p>
            </div>

            <div className="space-y-3 pt-4">
              {selectedFlagged.status === "open" && (
                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-hover text-main border border-border rounded-lg font-bold hover:bg-surface transition-all active:scale-95">
                    <Eye className="w-4 h-4" /> Review
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg font-bold shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all active:scale-95">
                    <CheckCircle className="w-4 h-4" /> Resolve
                  </button>
                </div>
              )}
              <button className="w-full flex items-center justify-center gap-2 py-3 border border-red-500/20 text-red-500 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/5 transition-all active:scale-95">
                <Trash2 className="w-4 h-4" /> Remove Content Asset
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Report Detail Drawer */}
      <DetailDrawer open={!!selectedReport} onClose={() => setSelectedReport(null)} title={`Report Case: ${selectedReport?.id || ""}`}>
        {selectedReport && (
          <div className="space-y-8 p-1">
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Subject Asset</p>
                <p className="font-bold text-main leading-tight">{selectedReport.postTitle}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Complainant</p>
                <div className="flex items-center gap-2 text-sm font-bold text-main">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">{selectedReport.reporterName.charAt(0)}</div>
                  {selectedReport.reporterName}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Allegation</p>
                <p className="text-xs font-bold text-muted uppercase bg-surface-hover px-2 py-0.5 rounded inline-block">{selectedReport.reason}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Case Status</p>
                <StatusBadge status={selectedReport.status} />
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Target Resource ID</p>
                <p className="text-sm font-mono font-bold text-primary px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">{selectedReport.postId}</p>
              </div>
            </div>

            <div className="p-4 bg-background border border-border rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Complainant Narrative</p>
              <p className="text-sm leading-relaxed text-main italic font-medium">&ldquo;{selectedReport.details}&rdquo;</p>
            </div>

            <div className="space-y-3 pt-4">
              {selectedReport.status === "pending" && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-500/20 text-red-500 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/5 transition-all">
                      <Trash2 className="w-4 h-4" /> Purge Post
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-bold rounded-lg shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all">
                      <UserX className="w-4 h-4" /> Restrict Author
                    </button>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 py-3 border border-border text-muted font-bold rounded-lg hover:bg-surface-hover transition-all">
                    <XCircle className="w-4 h-4" /> Dismiss Allegations
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Blocked Detail Drawer */}
      <DetailDrawer open={!!selectedBlocked} onClose={() => setSelectedBlocked(null)} title="Account Restriction Narrative">
        {selectedBlocked && (
          <div className="space-y-8 p-1">
            <div className="flex items-center gap-5 p-5 bg-red-500/5 border border-red-500/20 rounded-2xl shadow-inner">
              <div className="w-14 h-14 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                <UserX className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-main uppercase tracking-tight">{selectedBlocked.userName}</p>
                <p className="text-[10px] text-muted font-mono font-bold">{selectedBlocked.userId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-6 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Enforcing Admin</p>
                <p className="text-sm font-bold text-main">{selectedBlocked.blockedBy.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Restriction Applied</p>
                <p className="text-sm font-medium">{selectedBlocked.blockedAt}</p>
              </div>
            </div>

            <div className="p-4 bg-background border border-border rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Enforcement Reason</p>
              <p className="text-sm leading-relaxed text-main font-medium italic">&ldquo;{selectedBlocked.reason}&rdquo;</p>
            </div>

            <button className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-emerald-500/10 hover:bg-emerald-600 transition-all active:scale-95">
              <ShieldAlert className="w-4 h-4" /> Restore Account Access
            </button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
