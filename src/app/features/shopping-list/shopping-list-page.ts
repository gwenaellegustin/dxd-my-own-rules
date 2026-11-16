import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { ClientService } from '../../core/services/client.service';
import { ShoppingListItem } from '../../core/models/shopping-list.model';
import { PanelsLayout } from '../../layout/panels-layout/panels-layout';
import { VehicleLogo } from '../../shared/vehicle-logo/vehicle-logo';
import { Icon } from '../../shared/icon/icon';
import { VehicleDialog } from '../../shared/vehicle-dialog/vehicle-dialog';
import { WorksheetStore } from '../../core/services/worksheet.store';
import { scrollIntoArea } from '../../shared/scroll-into-area';

interface ShoppingDay {
  date: string;
  items: ShoppingListItem[];
}

/**
 * Shopping list: items in the order they were added (grouped by day), each optionally linked to
 * a client (link to its page) and / or one of its vehicles (opens its vehicle info), checked
 * once ordered. Opens on the first item not
 * ordered yet (the older ones are above it); new items are added at the bottom.
 */
@Component({
  selector: 'app-shopping-list-page',
  imports: [DatePipe, RouterLink, TranslatePipe, PanelsLayout, VehicleLogo, Icon, VehicleDialog],
  templateUrl: './shopping-list-page.html',
  styleUrl: './shopping-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingListPage {
  protected readonly list = inject(ShoppingListService);
  protected readonly clients = inject(ClientService);
  protected readonly worksheets = inject(WorksheetStore);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly days = computed<ShoppingDay[]>(() => {
    const days = new Map<string, ShoppingListItem[]>();
    for (const item of this.list.items()) {
      const day = item.addedAt.slice(0, 10);
      days.set(day, [...(days.get(day) ?? []), item]);
    }
    return [...days].map(([date, items]) => ({ date, items }));
  });

  /** Vehicle info dialog (vehicle chip of an item); renaming the vehicle renames its worksheets */
  protected readonly openVehicle = signal<{ clientId: string; vehicleId: string } | null>(null);
  protected readonly dialogVehicle = computed(() => {
    const open = this.openVehicle();
    const client = open && this.clients.getById(open.clientId);
    const vehicle = client?.vehicles.find((v) => v.id === open!.vehicleId);
    return client && vehicle ? { client, vehicle } : null;
  });

  /** New item form */
  protected readonly newLabel = signal('');
  protected readonly newQuantity = signal(1);
  protected readonly newClientId = signal('');
  protected readonly newVehicleId = signal('');
  protected readonly newClientVehicles = computed(() => this.clients.getById(this.newClientId())?.vehicles ?? []);
  protected readonly sortedClients = computed(() =>
    [...this.clients.clients()].filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name)),
  );

  constructor() {
    // Once loaded: the first item not ordered yet at the top of the screen
    let scrolled = false;
    effect(() => {
      if (scrolled || this.list.items().length === 0) return;
      scrolled = true;
      requestAnimationFrame(() => {
        const first = this.host.nativeElement.querySelector('.item:not(.item--ordered)');
        if (first) scrollIntoArea(first);
      });
    });
  }

  protected clientOf(item: ShoppingListItem) {
    return this.clients.getById(item.clientId);
  }

  protected vehicleOf(item: ShoppingListItem) {
    return this.clientOf(item)?.vehicles.find((vehicle) => vehicle.id === item.vehicleId);
  }

  /** Click on the item itself (not on the checkbox, a link or a button): toggles "Ordered" */
  protected toggleFromRow(event: MouseEvent, item: ShoppingListItem): void {
    if ((event.target as HTMLElement).closest('a, button, input, label')) return;
    this.list.setOrdered(item.id, !item.ordered);
  }

  protected chooseClient(id: string): void {
    this.newClientId.set(id);
    this.newVehicleId.set('');
  }

  protected add(event: Event): void {
    event.preventDefault();
    const label = this.newLabel().trim();
    if (!label) return;
    const item = this.list.add({
      label,
      quantity: Math.max(1, this.newQuantity() || 1),
      clientId: this.newClientId() || undefined,
      vehicleId: this.newVehicleId() || undefined,
    });
    this.newLabel.set('');
    this.newQuantity.set(1);
    requestAnimationFrame(() => {
      const added = this.host.nativeElement.querySelector(`[data-area="item:${item.id}"]`);
      if (added) scrollIntoArea(added, { block: 'center', smooth: true });
    });
  }
}
