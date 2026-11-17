import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { ShoppingListItem } from '../models/shopping-list.model';

/** Shopping list, kept in memory for the prototype (replace the edits with API calls later) */
@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly api = inject(ApiService);

  private readonly _items = signal<ShoppingListItem[]>([]);

  /** Oldest first (order of addition) */
  readonly items = computed(() => [...this._items()].sort((a, b) => a.addedAt.localeCompare(b.addedAt)));

  /** Items not ordered yet: badge of the "Shopping list" navigation pill */
  readonly count = computed(() => this._items().filter((item) => !item.ordered).length);

  constructor() {
    this.api.get<ShoppingListItem[]>(API_ENDPOINTS.shoppingList).subscribe((items) => this._items.set(items));
  }

  add(item: Omit<ShoppingListItem, 'id' | 'addedAt' | 'ordered'>): ShoppingListItem {
    const added: ShoppingListItem = {
      ...item,
      id: crypto.randomUUID(),
      // Local time, like the other dates of the mock data
      addedAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 19),
      ordered: false,
    };
    this._items.update((items) => [...items, added]);
    return added;
  }

  setOrdered(id: string, ordered: boolean): void {
    this._items.update((items) => items.map((item) => (item.id === id ? { ...item, ordered } : item)));
  }

  remove(id: string): void {
    this._items.update((items) => items.filter((item) => item.id !== id));
  }

  /** Puts a removed item back as it was (same id and date); nothing if it is already there */
  restore(item: ShoppingListItem): void {
    this._items.update((items) => (items.some((existing) => existing.id === item.id) ? items : [...items, item]));
  }
}
