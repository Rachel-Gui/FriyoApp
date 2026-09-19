import type { FridgeItem } from '@/services/types';

export const QUICK_CHIPS = ['All', 'Fresh', 'Freeze', 'Pantry', 'Meat & Dairy'];
export const CATEGORY_OPTIONS = ['Produce', 'Protein', 'Dairy', 'Grains', 'Condiments', 'Beverages', 'Leftovers', 'Other'];
export const UNIT_OPTIONS = ['g', 'ml', 'pcs', 'kg', 'L', 'tbsp', 'tsp', 'cup', 'pack'];

export type ViewMode = 'list' | 'grid';
export type StorageFilter = 'all' | 'fridge' | 'freezer' | 'pantry';
export type FreshnessFilter = 'all' | 'expiring_today' | 'expiring_soon' | 'fresh' | 'long_shelf';
export type SortBy = 'expiry' | 'name' | 'category' | 'quantity' | 'recent';

export type FridgeFilters = {
  storageType: StorageFilter;
  category: string | null;
  freshness: FreshnessFilter;
  sortBy: SortBy;
};

export type UiItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  storageType: FridgeItem['storageType'];
  daysLeft: number | null;
  freshnessLabel: FridgeItem['freshnessLabel'];
  freshnessScore: number;
  expiryDate: string | null;
  emoji: string;
  tags: string[];
  calories?: number;
  source: FridgeItem;
};

export const DEFAULT_FILTERS: FridgeFilters = {
  storageType: 'all',
  category: null,
  freshness: 'all',
  sortBy: 'expiry',
};
