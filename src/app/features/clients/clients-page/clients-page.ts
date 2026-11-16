import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ClientService } from '../../../core/services/client.service';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { InvoiceStore } from '../../../core/services/invoice.store';
import { ClientActivityService } from '../../../core/services/client-activity.service';
import { invoiceTotals } from '../../../core/models/invoice.model';
import { Client, Vehicle } from '../../../core/models/client.model';
import { PanelsLayout } from '../../../layout/panels-layout/panels-layout';
import { CardBadge, SortOption, VehicleCardGroup, VehicleSidebar } from '../../../shared/vehicle-sidebar/vehicle-sidebar';
import { VehicleLogo } from '../../../shared/vehicle-logo/vehicle-logo';
import { VehicleDialog } from '../../../shared/vehicle-dialog/vehicle-dialog';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { Clearable } from '../../../shared/clearable/clearable';
import { Icon } from '../../../shared/icon/icon';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { familyName, sameName } from '../../../core/utils/names';


/**
 * Clients: list on the left ("New client" at the top); for the selected client, its details
 * (name, address, hourly rate of its invoices, all editable), its vehicles (tiles that filter
 * what is shown below, all selected at first; each opens its vehicle file), its open worksheets
 * and its invoices. The transcript panel stays on the right, as on the other pages.
 */
@Component({
  selector: 'app-clients-page',
  imports: [
    DatePipe,
    RouterLink,
    TranslatePipe,
    PanelsLayout,
    VehicleSidebar,
    VehicleLogo,
    VehicleDialog,
    ConfirmDialog,
    Clearable,
    Icon,
    MoneyPipe,
  ],
  templateUrl: './clients-page.html',
  styleUrl: './clients-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  private readonly router = inject(Router);
  protected readonly clients = inject(ClientService);
  private readonly worksheets = inject(WorksheetStore);
  protected readonly invoices = inject(InvoiceStore);
  private readonly activity = inject(ClientActivityService);
  private readonly layout = viewChild.required(PanelsLayout);

  /** Route parameter `:id` (bound via withComponentInputBinding) */
  readonly id = input<string>();

  protected readonly sortOptions: SortOption[] = [
    { id: 'name', labelKey: 'clients.sort.name' },
    { id: 'date', labelKey: 'clients.sort.date' },
  ];
  /** Order of the list: family name (default) or last activity */
  protected readonly sort = signal<string | null>('name');

  /** Family name order (last word: "Fabrice Favre" → Favre), or most recent activity first */
  private readonly sortedClients = computed(() => {
    const byName = (a: Client, b: Client) =>
      familyName(a.name).localeCompare(familyName(b.name)) || a.name.localeCompare(b.name);
    const clients = [...this.clients.clients()];
    if (this.sort() === 'date') {
      return clients.sort(
        (a, b) => this.activity.of(b.name).lastDate.localeCompare(this.activity.of(a.name).lastDate) || byName(a, b),
      );
    }
    return clients.sort(byName);
  });

  protected readonly client = computed(() => this.clients.getById(this.id()));

  /** Active clients, then the archived ones in their own group */
  protected readonly cardGroups = computed<VehicleCardGroup[]>(() =>
    [
      { id: 'clients', titleKey: null, archived: false },
      { id: 'archived', titleKey: 'clients.archivedGroup', archived: true },
    ].map(({ id, titleKey, archived }) => ({
      id,
      titleKey,
      cards: this.sortedClients()
        .filter((client) => !!client.archived === archived)
        .map((client) => ({
          id: client.id,
          vehicle: '',
          client: client.name,
          date: null,
          title: client.name,
          subtitle: `${client.address.postcode} ${client.address.city}`.trim(),
          icon: 'person' as const,
          badges: this.badgesOf(client),
        })),
    })),
  );

  private readonly clientWorksheets = computed(() => {
    const client = this.client();
    return client?.name.trim()
      ? this.worksheets.worksheets().filter((worksheet) => sameName(worksheet.client, client.name))
      : [];
  });

  /** Vehicles (ids) whose worksheets and invoices are hidden: none when the client changes */
  protected readonly hidden = linkedSignal({ source: this.id, computation: () => new Set<string>() });

  /** A worksheet's vehicle is shown unless it is the vehicle of an unselected tile */
  private readonly isShown = (vehicleName: string) =>
    !this.client()?.vehicles.some((vehicle) => this.hidden().has(vehicle.id) && sameName(vehicle.name, vehicleName));

  protected readonly openWorksheets = computed(() =>
    this.clientWorksheets()
      .filter((worksheet) => worksheet.status === 'open' && this.isShown(worksheet.vehicle))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
  );

  /** Invoices of the client (through their worksheet), newest first, with their total */
  protected readonly clientInvoices = computed(() => {
    const vatRate = this.invoices.company()?.vatRate ?? 0;
    const worksheets = new Map(this.clientWorksheets().map((worksheet) => [worksheet.id, worksheet]));
    return this.invoices
      .invoices()
      .filter((invoice) => {
        const worksheet = worksheets.get(invoice.worksheetId);
        return worksheet && this.isShown(worksheet.vehicle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
      .map((invoice) => ({
        invoice,
        vehicle: worksheets.get(invoice.worksheetId)?.vehicle ?? '',
        total: invoiceTotals(invoice, vatRate).total,
      }));
  });

  /** Vehicle file open in the dialog; `isNew`: just added (dropped on close if left empty) */
  protected readonly openVehicle = signal<{ id: string; isNew: boolean } | null>(null);
  protected readonly dialogVehicle = computed(() => {
    const open = this.openVehicle();
    return open ? this.client()?.vehicles.find((vehicle) => vehicle.id === open.id) : undefined;
  });

  /** Client name when its field got the focus (worksheets follow a new name, see onNameCommit) */
  private nameBefore = '';

  /** A client with worksheets (and their invoices) is archived instead of deleted */
  protected readonly hasWorksheets = computed(() => this.clientWorksheets().length > 0);
  protected readonly confirmDelete = signal(false);

  constructor() {
    // A new client left without any edit (another one shown, other page) is removed silently
    let shownId: string | undefined;
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (shownId && shownId !== id) this.clients.discardIfUntouched(shownId);
        shownId = id;
      });
    });
    inject(DestroyRef).onDestroy(() => shownId && this.clients.discardIfUntouched(shownId));

    this.worksheets.load();
    this.invoices.load();

    // Without a valid id, show the first client
    effect(() => {
      const first = this.sortedClients().find((client) => !client.archived) ?? this.sortedClients()[0];
      if (first && !this.client()) this.router.navigate(['/clients', first.id], { replaceUrl: true });
    });
  }

  /** Open worksheets (grey), open invoices (blue), sent invoices not paid (red); none when 0 */
  private badgesOf(client: Client): CardBadge[] {
    const activity = this.activity.of(client.name);
    const badges: CardBadge[] = [
      { count: activity.openWorksheets, icon: 'tool', tone: 'neutral', labelKey: 'clients.badges.openWorksheets' },
      { count: activity.openInvoices, icon: 'invoice', tone: 'open', labelKey: 'clients.badges.openInvoices' },
      { count: activity.sentInvoices, icon: 'send', tone: 'alert', labelKey: 'clients.badges.sentInvoices' },
    ];
    return badges.filter((badge) => badge.count > 0);
  }

  protected select(id: string): void {
    this.openVehicle.set(null);
    this.router.navigate(['/clients', id]);
    this.layout().closeSidebarOnSmallScreens();
  }

  protected create(): void {
    const client = this.clients.create();
    this.router.navigate(['/clients', client.id]);
    this.layout().closeSidebarOnSmallScreens();
  }

  protected onNameFocus(event: Event): void {
    this.nameBefore = (event.target as HTMLInputElement).value;
  }

  /** Worksheets refer to their client by name: they follow the new name (when the field is left) */
  protected onNameCommit(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.worksheets.rename('client', this.nameBefore, name);
    this.nameBefore = name;
  }

  /** Archived: kept with its documents, listed under "Archived"; can be restored */
  protected setArchived(client: Client, archived: boolean): void {
    this.clients.setArchived(client.id, archived);
  }

  /** Deleted after confirmation; the first client of the list is shown instead */
  protected remove(client: Client): void {
    this.confirmDelete.set(false);
    this.clients.remove(client.id);
    const next = this.sortedClients().find((other) => !other.archived);
    this.router.navigate(next ? ['/clients', next.id] : ['/clients'], { replaceUrl: true });
  }

  protected toggleVehicle(id: string): void {
    this.hidden.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected addVehicle(client: Client): void {
    const vehicle = this.clients.addVehicle(client.id);
    this.openVehicle.set({ id: vehicle.id, isNew: true });
  }

  /** New worksheet for this vehicle (and this client), then opened */
  protected createWorksheet(client: Client, vehicle: Vehicle): void {
    const worksheet = this.worksheets.create(vehicle.kind, { client: client.name, vehicle: vehicle.name });
    this.router.navigate(['/worksheets', worksheet.id]);
  }

  protected renameVehicle(client: Client, { from, to }: { from: string; to: string }): void {
    this.worksheets.rename('vehicle', from, to, client.name);
  }

  /** A vehicle added then closed without any information is not kept */
  protected closeVehicle(client: Client, vehicleId: string): void {
    const isNew = this.openVehicle()?.isNew;
    this.openVehicle.set(null);
    const vehicle = this.clients.getById(client.id)?.vehicles.find((v) => v.id === vehicleId);
    if (isNew && vehicle && !vehicle.name.trim() && !vehicle.plate.trim() && !vehicle.registrationImage) {
      this.clients.removeVehicle(client.id, vehicle.id);
    }
  }
}
