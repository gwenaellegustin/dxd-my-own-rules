import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { ShoppingListItem } from '../models/shopping-list.model';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly api = inject(ApiService);

  readonly items = toSignal(this.api.get<ShoppingListItem[]>(API_ENDPOINTS.shoppingList), {
    initialValue: [] as ShoppingListItem[],
  });

  /** Shown as a badge on the "Shopping list" navigation pill */
  readonly count = computed(() => this.items().length);
}
