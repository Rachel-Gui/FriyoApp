import { Colors } from '@/constants/Colors';
import type { FridgeItem } from '@/services/types';
import type { FridgeFilters, StorageFilter, UiItem } from './types';

export function itemName(item: FridgeItem): string {
  return item.customName || item.ingredient?.name || 'Unnamed item';
}

export function normalizeCategory(category?: string | null, name = ''): string {
  const source = `${category ?? ''} ${name}`.trim().toLowerCase();

  if (/vegetable|fruit|produce|greens|spinach|lettuce|cucumber|tomato|avocado|garlic|onion|citrus|apple|banana|lemon|lime|orange/.test(source)) {
    return 'Produce';
  }
  if (/protein|meat|seafood|chicken|beef|pork|turkey|fish|salmon|tuna|shrimp|egg/.test(source)) {
    return 'Protein';
  }
  if (/dairy|milk|yogurt|cheese|cream|butter/.test(source)) {
    return 'Dairy';
  }
  if (/grain|rice|pasta|noodle|bread|dumpling|oat|flour|cereal/.test(source)) {
    return 'Grains';
  }
  if (/condiment|sauce|oil|pesto|soy|vinegar|spice|seasoning|jar/.test(source)) {
    return 'Condiments';
  }
  if (/beverage|drink|juice|tea|coffee/.test(source)) {
    return 'Beverages';
  }
  if (/leftover|meal prep|prepared/.test(source)) {
    return 'Leftovers';
  }
  return 'Other';
}

export function itemCategory(item: FridgeItem): string {
  return normalizeCategory(item.ingredient?.category, itemName(item));
}

export function itemEmoji(item: FridgeItem): string {
  const text = `${itemName(item)} ${itemCategory(item)}`.toLowerCase();
  if (/egg/.test(text)) return '🥚';
  if (/pesto|jar/.test(text)) return '🫙';
  if (/yogurt/.test(text)) return '🫙';
  if (/milk|cream|cheese|dairy/.test(text)) return '🥛';
  if (/chicken|turkey|pork|beef|meat/.test(text)) return '🍗';
  if (/fish|salmon|tuna|shrimp|seafood/.test(text)) return '🐟';
  if (/dumpling/.test(text)) return '🥟';
  if (/rice|grain/.test(text)) return '🍚';
  if (/pasta|noodle/.test(text)) return '🍝';
  if (/bread|toast/.test(text)) return '🍞';
  if (/apple|fruit/.test(text)) return '🍎';
  if (/banana/.test(text)) return '🍌';
  if (/citrus|orange|lemon|lime/.test(text)) return '🍋';
  if (/avocado/.test(text)) return '🥑';
  if (/tomato/.test(text)) return '🍅';
  if (/garlic/.test(text)) return '🧄';
  if (/spinach|lettuce|vegetable|greens|cucumber/.test(text)) return '🥬';
  if (/sauce|oil|condiment|jar/.test(text)) return '🫙';
  if (/beverage|drink|juice/.test(text)) return '🧃';
  return '🥡';
}

export function toUiItem(item: FridgeItem): UiItem {
  return {
    id: item.id,
    name: itemName(item),
    category: itemCategory(item),
    quantity: Number(item.quantity || 0),
    unit: item.unit || '',
    storageType: item.storageType,
    daysLeft: item.daysUntilExpiry,
    freshnessLabel: item.freshnessLabel,
    freshnessScore: item.freshnessScore,
    expiryDate: item.expiryDate,
    emoji: itemEmoji(item),
    tags: item.ingredient?.tags ?? [],
    calories: item.ingredient?.caloriesPer100g,
    source: item,
  };
}

export function freshnessColor(label: FridgeItem['freshnessLabel']): string {
  switch (label) {
    case 'expired':       return Colors.red;
    case 'expiring_soon': return Colors.orange;
    case 'good':          return '#F59E0B';
    case 'fresh':         return Colors.green;
    default:              return Colors.gray;
  }
}

export function freshnessText(item: UiItem): string {
  if (!item.expiryDate && item.daysLeft == null) return 'No expiry set';
  if (item.freshnessLabel === 'expired') return 'Expired';
  if (item.daysLeft === 0) return 'Expires today';
  if (item.daysLeft === 1) return 'Expires tomorrow';
  if (item.daysLeft != null && item.daysLeft <= 3) return `${item.daysLeft}d left`;
  if (item.daysLeft != null && item.daysLeft <= 7) return `Fresh · ${item.daysLeft}d`;
  if (item.daysLeft != null) return `${item.daysLeft}d`;
  return 'Good';
}

export function storageLabel(type: FridgeItem['storageType']): string {
  if (type === 'freezer') return 'Frozen';
  if (type === 'pantry') return 'Pantry';
  return 'Refrigerated';
}

export function storageChipToType(chip: string): StorageFilter | null {
  if (chip === 'Fresh' || chip === 'Fridge') return 'fridge';
  if (chip === 'Freeze' || chip === 'Freezer') return 'freezer';
  if (chip === 'Pantry') return 'pantry';
  return null;
}

export function dateFromDays(days: number): string | null {
  if (!Number.isFinite(days) || days < 0) return null;
  const next = new Date();
  next.setDate(next.getDate() + Math.round(days));
  return next.toISOString().slice(0, 10);
}

export function daysFromExpiry(expiryDate: string | null): number {
  if (!expiryDate) return 7;
  const today = new Date();
  const expiry = new Date(expiryDate);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((expiry.getTime() - today.getTime()) / 86400000));
}

export function applyFilters(items: UiItem[], filters: FridgeFilters, quickChip: string, searchQuery: string): UiItem[] {
  let result = [...items];

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      storageLabel(item.storageType).toLowerCase().includes(query)
    );
  }

  const chipStorage = storageChipToType(quickChip);
  if (chipStorage) {
    result = result.filter(item => item.storageType === chipStorage);
  } else if (quickChip === 'Meat & Dairy') {
    result = result.filter(item => item.category === 'Protein' || item.category === 'Dairy');
  } else if (quickChip !== 'All') {
    result = result.filter(item => item.category.toLowerCase() === quickChip.toLowerCase());
  }

  if (filters.storageType !== 'all') {
    result = result.filter(item => item.storageType === filters.storageType);
  }

  if (filters.category) {
    result = result.filter(item => item.category.toLowerCase() === filters.category!.toLowerCase());
  }

  switch (filters.freshness) {
    case 'expiring_today':
      result = result.filter(item => item.daysLeft === 0 || item.freshnessLabel === 'expired');
      break;
    case 'expiring_soon':
      result = result.filter(item => item.freshnessLabel === 'expiring_soon' || item.freshnessLabel === 'expired');
      break;
    case 'fresh':
      result = result.filter(item => item.freshnessLabel === 'good');
      break;
    case 'long_shelf':
      result = result.filter(item => item.freshnessLabel === 'fresh');
      break;
  }

  switch (filters.sortBy) {
    case 'expiry':
      result.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
      break;
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'category':
      result.sort((a, b) => a.category.localeCompare(b.category));
      break;
    case 'quantity':
      result.sort((a, b) => b.quantity - a.quantity);
      break;
    case 'recent':
      result.sort((a, b) => b.id.localeCompare(a.id));
      break;
  }

  return result;
}

export function groupItems(items: UiItem[]) {
  const alert = items.filter(item => item.freshnessLabel === 'expired' || item.freshnessLabel === 'expiring_soon');
  const refrigerated = items.filter(item => item.storageType === 'fridge' && !alert.includes(item));
  const frozen = items.filter(item => item.storageType === 'freezer' && !alert.includes(item));
  const pantry = items.filter(item => item.storageType === 'pantry' && !alert.includes(item));

  return [
    { key: 'alert', title: 'Freshness Alert', items: alert },
    { key: 'fridge', title: 'Refrigerated', items: refrigerated },
    { key: 'freezer', title: 'Frozen', items: frozen },
    { key: 'pantry', title: 'Pantry', items: pantry },
  ].filter(group => group.items.length > 0);
}

export function activeFilterCount(filters: FridgeFilters): number {
  return [
    filters.storageType !== 'all',
    filters.category !== null,
    filters.freshness !== 'all',
    filters.sortBy !== 'expiry',
  ].filter(Boolean).length;
}
