import { create } from 'zustand';

export type StatusFilter = 'active' | 'expired' | 'consumed' | 'archived' | 'all';

interface UiState {
  /** 'all' or a space id. */
  spaceId: string;
  status: StatusFilter;
  categoryId: string | null;
  location: string | null;
  setSpace: (id: string) => void;
  setStatus: (s: StatusFilter) => void;
  setCategory: (id: string | null) => void;
  setLocation: (l: string | null) => void;
  resetFilters: () => void;
}

export const useUi = create<UiState>((set) => ({
  spaceId: 'all',
  status: 'active',
  categoryId: null,
  location: null,
  setSpace: (spaceId) => set({ spaceId }),
  setStatus: (status) => set({ status }),
  setCategory: (categoryId) => set({ categoryId }),
  setLocation: (location) => set({ location }),
  resetFilters: () => set({ status: 'active', categoryId: null, location: null }),
}));
