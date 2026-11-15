import { ChangeDetectionStrategy, Component, computed, effect, inject, input, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InvoiceStore } from '../../../core/services/invoice.store';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { ClientService } from '../../../core/services/client.service';
import { Invoice } from '../../../core/models/invoice.model';
import { PanelsLayout } from '../../../layout/panels-layout/panels-layout';
import { VehicleCardGroup, VehicleSidebar } from '../../../shared/vehicle-sidebar/vehicle-sidebar';
import { InvoiceDocument, ItemChange } from '../invoice-document/invoice-document';
import { Icon } from '../../../shared/icon/icon';

/** Invoices: list on the left (open, sent, paid), the selected invoice in the middle. */
@Component({
  selector: 'app-invoice-page',
  imports: [TranslatePipe, Icon, PanelsLayout, VehicleSidebar, InvoiceDocument],
  templateUrl: './invoice-page.html',
  styleUrl: './invoice-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicePage {
  private readonly router = inject(Router);
  protected readonly store = inject(InvoiceStore);
  protected readonly worksheets = inject(WorksheetStore);
  protected readonly clients = inject(ClientService);
  private readonly translate = inject(TranslateService);
  private readonly layout = viewChild.required(PanelsLayout);

  /** Route parameter `:id` (bound via withComponentInputBinding) */
  readonly id = input<string>();

  protected readonly invoice = computed(() => this.store.getById(this.id() ?? null));
  protected readonly loaded = computed(() => this.store.loaded() && this.worksheets.loaded());

  /** Invoices as cards of the left panel; vehicle and client come from their worksheet */
  protected readonly cardGroups = computed<VehicleCardGroup[]>(() => {
    const byStatus = this.store.byStatus();
    const cards = (invoices: Invoice[]) =>
      invoices.map((invoice) => {
        const worksheet = this.worksheets.getById(invoice.worksheetId);
        return { id: invoice.id, vehicle: worksheet?.vehicle ?? '', client: worksheet?.client ?? '', date: invoice.date };
      });
    return [
      { id: 'open', titleKey: null, cards: cards(byStatus.open) },
      { id: 'sent', titleKey: 'invoices.groups.sent', cards: cards(byStatus.sent) },
      { id: 'paid', titleKey: 'invoices.groups.paid', cards: cards(byStatus.paid) },
    ];
  });

  constructor() {
    this.store.load();
    this.worksheets.load();

    // Without a valid id, show the first open invoice
    effect(() => {
      if (!this.loaded() || this.invoice()) return;
      const first = this.store.byStatus().open[0] ?? this.store.invoices()[0];
      if (first) this.router.navigate(['/invoices', first.id], { replaceUrl: true });
    });
  }

  protected select(id: string): void {
    this.router.navigate(['/invoices', id]);
    this.layout().closeSidebarOnSmallScreens();
  }

  /**
   * No backend yet: the browser prints the invoice (its print dialog offers "Save as PDF").
   * The print styles keep only the invoice; the page title becomes the suggested file name.
   */
  protected saveAsPdf(invoice: Invoice, client: string | undefined): void {
    const title = document.title;
    const number = this.translate.instant('invoice.number', { number: invoice.number });
    document.title = client ? `${number} - ${client}` : number;
    window.print();
    document.title = title;
  }

  protected changeItem(invoiceId: string, { sectionId, itemId, changes }: ItemChange): void {
    this.store.updateItem(invoiceId, sectionId, itemId, changes);
  }
}
