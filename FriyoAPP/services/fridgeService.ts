// ─────────────────────────────────────────────────────────────────────────────
// services/fridgeService.ts
// ─────────────────────────────────────────────────────────────────────────────

import { get, post, postForm, patch, del } from './api';
import type { FridgeItem, ScanSession, ScannedItem } from './types';

interface GetItemsParams {
  storageType?: 'fridge' | 'freezer' | 'pantry';
  sort?:        'expiry' | 'name' | 'freshness';
}

interface AddItemData {
  ingredientId?: string;
  customName:    string;
  quantity:      number;
  unit:          string;
  storageType:   'fridge' | 'freezer' | 'pantry';
  expiryDate?:   string | null;
}

type ConfirmScanPayloadItem = {
  ingredient_id?: string | null;
  custom_name: string;
  quantity: number;
  unit?: string | null;
  storage_type: 'fridge' | 'freezer' | 'pantry';
  expiry_date?: string | null;
};

function normalizeStorageType(value: unknown): 'fridge' | 'freezer' | 'pantry' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['freezer', 'freeze', 'frozen'].includes(normalized)) return 'freezer';
  if (normalized === 'pantry') return 'pantry';
  return 'fridge';
}

function dateFromShelfDays(days: unknown): string | null {
  const parsed = Number(days);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + Math.round(parsed));
  return date.toISOString().slice(0, 10);
}

function toConfirmScanItem(item: ScannedItem): ConfirmScanPayloadItem {
  const raw = item as any;
  const customName = raw.customName ?? raw.custom_name ?? raw.name ?? 'Item';
  const quantity = Number(raw.quantity ?? raw.estimatedQuantity ?? raw.estimated_quantity ?? 1);
  const expiryDate = raw.expiryDate ?? raw.expiry_date ?? dateFromShelfDays(raw.estimatedShelfDays ?? raw.estimated_shelf_days);

  return {
    ingredient_id: raw.ingredientId ?? raw.ingredient_id ?? null,
    custom_name: String(customName),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit: raw.unit ?? null,
    storage_type: normalizeStorageType(raw.storageType ?? raw.storage_type),
    expiry_date: expiryDate,
  };
}

function itemPayload(data: Partial<AddItemData>) {
  return {
    ...(data.ingredientId !== undefined ? { ingredient_id: data.ingredientId } : {}),
    ...(data.customName !== undefined ? { custom_name: data.customName } : {}),
    ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
    ...(data.unit !== undefined ? { unit: data.unit } : {}),
    ...(data.storageType !== undefined ? { storage_type: data.storageType } : {}),
    ...(data.expiryDate !== undefined ? { expiry_date: data.expiryDate } : {}),
  };
}

export const fridgeService = {

  /** List all fridge items, optionally filtered by storage type / sort order. */
  async getItems(params?: GetItemsParams): Promise<FridgeItem[]> {
    const qs = new URLSearchParams();
    if (params?.storageType) qs.set('storage_type', params.storageType);
    if (params?.sort)        qs.set('sort', params.sort);
    const q = qs.toString();
    return get<FridgeItem[]>(`/fridge${q ? `?${q}` : ''}`);
  },

  /** Add a single item to the fridge. */
  async addItem(data: AddItemData): Promise<FridgeItem> {
    return post<FridgeItem>('/fridge/items', itemPayload(data));
  },

  /** Update quantity / expiry / storage type on an existing item. */
  async updateItem(id: string, data: Partial<AddItemData>): Promise<FridgeItem> {
    return patch<FridgeItem>(`/fridge/items/${id}`, itemPayload(data));
  },

  /** Delete a single fridge item by ID. */
  async deleteItem(id: string): Promise<void> {
    return del<void>(`/fridge/items/${id}`);
  },

  /** Bulk-delete multiple fridge items. */
  async deleteItems(ids: string[]): Promise<void> {
    return del<void>('/fridge/items', { ids });
  },

  /**
   * Start a fridge scan: converts imageUri to multipart FormData and
   * POSTs to /fridge/scan.  Returns a ScanSession with initial status.
   */
  async startScan(imageUri: string): Promise<ScanSession> {
    const form = new FormData();
    form.append('image', {
      uri:  imageUri,
      name: 'fridge_scan.jpg',
      type: 'image/jpeg',
    } as any);
    return postForm<ScanSession>('/fridge/scan', form);
  },

  /** Poll scan status until 'completed' or 'failed'. */
  async pollScan(sessionId: string): Promise<ScanSession> {
    return get<ScanSession>(`/fridge/scan/${sessionId}`);
  },

  /**
   * Confirm scanned items (after user reviews/edits them).
   * Returns the newly created FridgeItem list.
   */
  async confirmScan(sessionId: string, items: ScannedItem[]): Promise<FridgeItem[]> {
    return post<FridgeItem[]>(`/fridge/scan/${sessionId}/confirm`, {
      items: items.map(toConfirmScanItem),
    });
  },

  /**
   * Deduct ingredient quantities used by cooking a recipe.
   * Called after the user finishes cooking.
   */
  async deductIngredients(recipeId: string, servingsUsed: number): Promise<void> {
    return post<void>('/fridge/deduct', { recipe_id: recipeId, servings_used: servingsUsed });
  },
};
