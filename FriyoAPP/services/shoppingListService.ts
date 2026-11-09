import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'friyo_shopping_list_v1';

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  recipeId?: string;
  recipeTitle?: string;
}

type NewShoppingListItem = Omit<ShoppingListItem, 'id' | 'checked'>;

function itemKey(item: Pick<ShoppingListItem, 'name' | 'unit'>) {
  return `${item.name.trim().toLowerCase()}::${item.unit.trim().toLowerCase()}`;
}

async function read(): Promise<ShoppingListItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function write(items: ShoppingListItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items;
}

export const shoppingListService = {
  getItems: read,

  async addItems(incoming: NewShoppingListItem[]) {
    const current = await read();
    const byKey = new Map(current.map(item => [itemKey(item), item]));

    for (const item of incoming) {
      if (!item.name.trim()) continue;
      const key = itemKey(item);
      const existing = byKey.get(key);
      if (existing) {
        existing.quantity = Math.max(existing.quantity, item.quantity);
        existing.checked = false;
        existing.recipeId = item.recipeId;
        existing.recipeTitle = item.recipeTitle;
      } else {
        const created: ShoppingListItem = {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          checked: false,
        };
        current.push(created);
        byKey.set(key, created);
      }
    }

    return write(current);
  },

  async toggle(id: string) {
    const items = await read();
    const item = items.find(value => value.id === id);
    if (item) item.checked = !item.checked;
    return write(items);
  },

  async remove(id: string) {
    return write((await read()).filter(item => item.id !== id));
  },

  async clearChecked() {
    return write((await read()).filter(item => !item.checked));
  },
};
