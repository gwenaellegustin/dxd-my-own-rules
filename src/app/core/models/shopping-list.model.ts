/** Something to buy, optionally for a client and / or one of its vehicles */
export interface ShoppingListItem {
  id: string;
  label: string;
  quantity: number;
  /** ISO date-time: the list is ordered by it */
  addedAt: string;
  clientId?: string;
  vehicleId?: string;
  /** Ordered from the supplier */
  ordered: boolean;
}
