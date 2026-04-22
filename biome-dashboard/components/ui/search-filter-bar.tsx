"use client";

import { Search, SlidersHorizontal, X, Download, CheckCircle, XCircle, Trash2 } from "lucide-react";

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onClearFilters?: () => void;
  selectedCount?: number;
  onBulkApprove?: () => void;
  onBulkReject?: () => void;
  onBulkDelete?: () => void;
  onExport?: () => void;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search ecosystem...",
  filters = [],
  activeFilters = {},
  onFilterChange,
  onClearFilters,
  selectedCount = 0,
  onBulkApprove,
  onBulkReject,
  onBulkDelete,
  onExport,
}: SearchFilterBarProps) {
  const hasActiveFilters = Object.values(activeFilters).some((v) => v && v !== "all");
  const activeCount = Object.values(activeFilters).filter((v) => v && v !== "all").length;

  return (
    <div className="flex flex-col gap-4 mb-8 animate-fade-in">
      <div className="flex flex-wrap items-center gap-4">
        {/* Elite Search Node */}
        <div className="relative group flex-1 min-w-[280px]">
          <div className="absolute inset-0 bg-primary/5 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-11 pr-4 py-3 rounded-2xl input-premium"
            />
          </div>
        </div>

        {/* Dynamic Parameter Sectors */}
        <div className="flex flex-wrap items-center gap-3">
          {filters.map((filter) => {
            const isActive = activeFilters[filter.key] && activeFilters[filter.key] !== "all";
            return (
              <div key={filter.key} className="relative group">
                <select
                  value={activeFilters[filter.key] || "all"}
                  onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                  className={`appearance-none rounded-xl px-4 py-3 pr-10 text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all border
                    ${isActive 
                      ? "bg-primary/5 border-primary/30 text-primary shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                      : "bg-surface border-white/5 text-muted hover:border-white/10 hover:text-main"
                    }
                  `}
                >
                  <option value="all">{filter.label}</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <SlidersHorizontal
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none transition-colors
                    ${isActive ? "text-primary" : "text-muted opacity-30 group-hover:opacity-100"}
                  `}
                />
              </div>
            );
          })}

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
            >
              <X className="w-3 h-3" />
              Reset System{activeCount > 1 ? ` (${activeCount})` : ""}
            </button>
          )}
        </div>

        <div className="flex-1 min-w-[20px]" />

        {onExport && (
          <button
            onClick={onExport}
            className="btn-secondary h-[48px] flex items-center justify-center gap-2 px-6"
          >
            <Download className="w-4 h-4" />
            <span className="mt-0.5">Export Data</span>
          </button>
        )}
      </div>

      {/* Bulk Authority Overlay */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-2 px-2 rounded-2xl bg-primary/5 border border-primary/20 shadow-[0_0_30px_rgba(16,185,129,0.05)] animate-fade-in relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <div className="flex items-center gap-4 px-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
              {selectedCount}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Elements marked for authority
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onBulkApprove && (
              <button
                onClick={onBulkApprove}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Initialize Approval
              </button>
            )}
            {onBulkReject && (
              <button
                onClick={onBulkReject}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                <XCircle className="w-3.5 h-3.5" />
                Execute Rejection
              </button>
            )}
            {onBulkDelete && (
              <button
                onClick={onBulkDelete}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
