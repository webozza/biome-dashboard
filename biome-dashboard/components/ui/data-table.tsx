"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox } from "lucide-react";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  selectedItems?: string[];
  onToggleItem?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  getId?: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  columns,
  data,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  selectedItems = [],
  onToggleItem,
  onSelectAll,
  getId,
  onRowClick,
  emptyMessage = "No results found",
  emptyDescription = "Adjust filters to synchronize data",
}: DataTableProps<T>) {
  const allSelected =
    getId && data.length > 0 && data.every((item) => selectedItems.includes(getId(item)));

  const itemCount = totalItems ?? data.length;

  return (
    <div className="table-container animate-fade-in pb-2">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {onToggleItem && getId && (
                <th className="table-header w-12 !pr-0">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={!!allSelected}
                      onChange={() => {
                        if (allSelected) onSelectAll?.([]);
                        else onSelectAll?.(data.map((item) => getId(item)));
                      }}
                      className="w-4 h-4 rounded-md border-white/10 bg-white/5 text-primary focus:ring-primary/20 transition-all cursor-pointer accent-primary"
                    />
                  </div>
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`table-header ${col.className || ""}`}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    <div className="w-1 h-3 bg-primary/10 rounded-full" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onToggleItem ? 1 : 0)}
                  className="py-24 text-center"
                >
                  <div className="flex flex-col items-center gap-6 opacity-40">
                    <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-inner">
                      <Inbox className="w-8 h-8 text-muted" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-main">
                        {emptyMessage}
                      </p>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest italic leading-relaxed">
                        {emptyDescription}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, i) => {
                const id = getId ? getId(item) : String(i);
                const isSelected = selectedItems.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(item)}
                    className={`table-row group ${isSelected ? "table-row-active" : ""} ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {onToggleItem && getId && (
                      <td className="table-cell w-12 !pr-0">
                        {isSelected && (
                          <div className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-r-full shadow-[0_0_10px_var(--primary)] z-10" />
                        )}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleItem(id);
                            }}
                            className="w-4 h-4 rounded-md border-white/10 bg-white/5 text-primary focus:ring-primary/20 transition-all cursor-pointer accent-primary"
                          />
                        </div>
                      </td>
                    )}
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`table-cell ${col.className || ""}`}
                      >
                        {isSelected && !onToggleItem && colIdx === 0 && (
                          <div className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-r-full shadow-[0_0_10px_var(--primary)] z-10" />
                        )}
                        <div className={`transition-transform duration-300 ${isSelected ? 'translate-x-1' : 'group-hover:translate-x-0.5'}`}>
                          {col.render ? col.render(item) : (
                            <span className="font-bold tracking-tight opacity-90 group-hover:opacity-100 italic text-sm">
                              {String((item as Record<string, unknown>)[col.key] ?? "")}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Advanced Pagination Node */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between px-8 py-6 border-t border-white/5 bg-surface/30 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 shadow-inner">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                Indices <span className="text-primary italic mx-1">
                  {Math.min((currentPage - 1) * 10 + 1, itemCount)}-{Math.min(currentPage * 10, itemCount)}
                </span> / <span className="text-main">{itemCount}</span> Total
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 opacity-20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <div className="w-8 h-[1px] bg-white" />
              <div className="w-1.5 h-1.5 rounded-full bg-white opacity-20" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PaginationBtn onClick={() => onPageChange(1)} disabled={currentPage <= 1}>
              <ChevronsLeft className="w-4 h-4" />
            </PaginationBtn>
            <PaginationBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </PaginationBtn>

            <div className="flex items-center bg-white/[0.03] rounded-xl border border-white/5 p-1 mx-2">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) page = i + 1;
                else if (currentPage <= 3) page = i + 1;
                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                else page = currentPage - 2 + i;
                
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-9 h-9 rounded-lg text-[11px] font-black uppercase tracking-tighter transition-all duration-300 ${
                      page === currentPage 
                        ? "bg-primary text-white shadow-lg shadow-emerald-500/20 scale-105" 
                        : "text-muted hover:text-main hover:bg-white/5"
                    }`}
                  >
                    {String(page).padStart(2, '0')}
                  </button>
                );
              })}
            </div>

            <PaginationBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
              <ChevronRight className="w-4 h-4" />
            </PaginationBtn>
            <PaginationBtn onClick={() => onPageChange(totalPages)} disabled={currentPage >= totalPages}>
              <ChevronsRight className="w-4 h-4" />
            </PaginationBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 bg-white/[0.02] shadow-sm transition-all duration-300 ${
        disabled 
          ? "opacity-10 cursor-not-allowed scale-95" 
          : "text-muted hover:text-primary hover:border-primary/30 hover:bg-primary/5 hover:scale-110 active:scale-90"
      }`}
    >
      {children}
    </button>
  );
}
