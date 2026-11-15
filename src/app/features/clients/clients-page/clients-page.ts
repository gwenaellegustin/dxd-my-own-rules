import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ClientService } from '../../../core/services/client.service';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { InvoiceStore } from '../../../core/services/invoice.store';
import { invoiceTotals } from '../../../core/models/invoice.model';
import { PanelsLayout } from '../../../layout/panels-layout/panels-layout';
import { VehicleCardGroup, VehicleSidebar } from '../../../shared/vehicle-sidebar/vehicle-sidebar';
import { VehicleLogo } from '../../../shared/vehicle-logo/vehicle-logo';
import { Icon } from '../../../shared/icon/icon';
import { MoneyPipe } from '../../../shared/money/money.pipe';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Clients: list on the left; for the selected client, its vehicles (tiles that filter what is
 * shown below, all selected at first), its open worksheets and its invoices.
 * No transcript panel on this page.
 */
@Component({
  selector: 'app-clients-page',
  imports: [DatePipe, RouterLink, TranslatePipe, PanelsLayout, VehicleSidebar, VehicleLogo, Icon, MoneyPipe],
  templateUrl: './clients-page.html',
  styleUrl: './clients-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  private readonly router = inject(Router);
  private readonly clients = inject(ClientService);
  private readonly worksheets = inject(WorksheetStore);
  protected readonly invoices = inject(InvoiceStore);
  private readonly layout = viewChild.required(PanelsLayout);

  /** Route parameter `:id` (bound via withComponentInputBinding) */
  readonly id = input<string>();

  private readonly sortedClients = computed(() =>
    [...this.clients.clients()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly client = computed(() => this.clients.clients().find((client) => client.id === this.id()));

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
        subtitle: `${client.address.postcode} ${client.address.city}`,
        icon: 'person' as const,
      })),
    },
  ]);

  private readonly clientWorksheets = computed(() => {
    const client = this.client();
    return client ? this.worksheets.worksheets().filter((worksheet) => sameName(worksheet.client, client.name)) : [];
  });

  /** Vehicles of the client, with those only known from its worksheets */
  protected readonly vehicles = computed(() => {
    const known = this.client()?.vehicles ?? [];
    const fromWorksheets = this.clientWorksheets()
      .map((worksheet) => worksheet.vehicle)
      .filter((name) => name && !known.some((vehicle) => sameName(vehicle.name, name)));
    return [...known, ...[...new Set(fromWorksheets)].map((name) => ({ name, plate: '' }))];
  });

  /** Vehicles whose worksheets and invoices are shown: all of them when the client changes */
  protected readonly selected = linkedSignal(() => new Set(this.vehicles().map((vehicle) => vehicle.name)));

  private readonly isShown = (vehicle: string) => [...this.selected()].some((name) => sameName(name, vehicle));

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
    this.router.navigate(['/clients', id]);
    this.layout().closeSidebarOnSmallScreens();
  }

  protected toggleVehicle(name: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }
}
