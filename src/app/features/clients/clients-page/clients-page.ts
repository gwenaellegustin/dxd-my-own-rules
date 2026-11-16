import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ClientService } from '../../../core/services/client.service';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { InvoiceStore } from '../../../core/services/invoice.store';
import { invoiceTotals } from '../../../core/models/invoice.model';
import { Address, Client, Vehicle } from '../../../core/models/client.model';
import { PanelsLayout } from '../../../layout/panels-layout/panels-layout';
import { VehicleCardGroup, VehicleSidebar } from '../../../shared/vehicle-sidebar/vehicle-sidebar';
import { VehicleLogo } from '../../../shared/vehicle-logo/vehicle-logo';
import { VehicleDialog } from '../../../shared/vehicle-dialog/vehicle-dialog';
import { Clearable } from '../../../shared/clearable/clearable';
import { Icon } from '../../../shared/icon/icon';
import { MoneyPipe } from '../../../shared/money/money.pipe';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Clients: list on the left ("New client" at the top); for the selected client, its details
 * (name, address, hourly rate of its invoices, all editable), its vehicles (tiles that filter
 * what is shown below, all selected at first; each opens its vehicle file), its open worksheets
 * and its invoices. No transcript panel on this page.
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
  private readonly layout = viewChild.required(PanelsLayout);

  /** Route parameter `:id` (bound via withComponentInputBinding) */
  readonly id = input<string>();

  private readonly sortedClients = computed(() =>
    [...this.clients.clients()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly client = computed(() => this.clients.getById(this.id()));

  protected readonly cardGroups = computed<VehicleCardGroup[]>(() => [
    {
      id: 'clients',
      titleKey: null,
      cards: this.sortedClients().map((client) => ({
        id: client.id,
        vehicle: '',
        client: client.name,
        date: null,
        title: client.name,
        subtitle: `${client.address.postcode} ${client.address.city}`.trim(),
        icon: 'person' as const,
      })),
    },
  ]);

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

  /** Client name when its field got the focus */
  private nameBefore = '';

  constructor() {
    this.worksheets.load();
    this.invoices.load();

    // Without a valid id, show the first client
    effect(() => {
      const first = this.sortedClients()[0];
      if (first && !this.client()) this.router.navigate(['/clients', first.id], { replaceUrl: true });
    });
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

  protected updateName(client: Client, event: Event): void {
    this.clients.update(client.id, { name: (event.target as HTMLInputElement).value });
  }

  protected onNameFocus(event: Event): void {
    this.nameBefore = (event.target as HTMLInputElement).value;
  }

  /** Worksheets refer to their client by name: they follow the new name */
  protected onNameCommit(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.worksheets.rename('client', this.nameBefore, name);
    this.nameBefore = name;
  }

  protected updateAddress(client: Client, field: keyof Address, event: Event): void {
    this.clients.updateAddress(client.id, { [field]: (event.target as HTMLInputElement).value });
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

  protected renameVehicle(client: Client, { from, to }: { from: string; to: string }): void {
    this.worksheets.rename('vehicle', from, to, client.name);
  }

  /** A vehicle added then closed without any information is not kept */
  protected closeVehicle(client: Client, vehicle: Vehicle): void {
    const isNew = this.openVehicle()?.isNew;
    this.openVehicle.set(null);
    if (isNew && !vehicle.name.trim() && !vehicle.plate.trim() && !vehicle.registrationImage) {
      this.clients.removeVehicle(client.id, vehicle.id);
    }
  }
}
