import { create } from "zustand";

interface DashboardState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  selectedItems: string[];
  toggleItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  currentPage: number;
  setPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (count: number) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  activeFilters: {},
  setFilter: (key, value) =>
    set((s) => ({
      activeFilters: { ...s.activeFilters, [key]: value },
      currentPage: 1,
    })),
  clearFilters: () => set({ activeFilters: {}, currentPage: 1 }),
  selectedItems: [],
  toggleItem: (id) =>
    set((s) => ({
      selectedItems: s.selectedItems.includes(id)
        ? s.selectedItems.filter((i) => i !== id)
        : [...s.selectedItems, id],
    })),
  selectAll: (ids) => set({ selectedItems: ids }),
  clearSelection: () => set({ selectedItems: [] }),
  currentPage: 1,
  setPage: (page) => set({ currentPage: page }),
  itemsPerPage: 10,
  setItemsPerPage: (count) => set({ itemsPerPage: count, currentPage: 1 }),
}));
