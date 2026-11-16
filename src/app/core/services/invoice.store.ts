import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { Company } from '../models/company.model';
import { Invoice, InvoiceItem, InvoiceSection, InvoiceStatus } from '../models/invoice.model';
import { TemplateSection } from '../models/worksheet-template.model';
import { Worksheet, parseQuantity } from '../models/worksheet.model';

/** Fields of an item that can be edited while the invoice is open */
export type EditableItemFields = Partial<Pick<InvoiceItem, 'quantity' | 'price' | 'discount'>>;

/**
 * Invoices and the garage settings (VAT, hourly rates…), kept in memory for the prototype;
 * replace the methods with API calls once a backend exists.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceStore {
  private readonly api = inject(ApiService);

  private readonly _invoices = signal<Invoice[]>([]);
  private readonly _company = signal<Company | null>(null);
  private readonly _loaded = signal(false);
  private loading = false;

  /** Shown invoices (not the ones of a reopened worksheet) */
  readonly invoices = computed(() => this._invoices().filter((invoice) => !invoice.hidden));
  readonly company = this._company.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** Invoices by status, newest first */
  readonly byStatus = computed(() => {
    const groups: Record<InvoiceStatus, Invoice[]> = { open: [], sent: [], paid: [] };
    const newestFirst = [...this.invoices()].sort(
      (a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number),
    );
    for (const invoice of newestFirst) groups[invoice.status].push(invoice);
    return groups;
  });

  load(): void {
    if (this._loaded() || this.loading) return;
    this.loading = true;
    forkJoin({
      invoices: this.api.get<Invoice[]>(API_ENDPOINTS.invoices),
      company: this.api.get<Company>(API_ENDPOINTS.company),
    }).subscribe(({ invoices, company }) => {
      // Invoices created before the data arrived stay on top
      this._invoices.update((created) => [...created, ...invoices]);
      this._company.set(company);
      this._loaded.set(true);
    });
  }

  getById(id: string | null): Invoice | undefined {
    return this.invoices().find((invoice) => invoice.id === id);
  }

  /** Most recent invoice of a worksheet */
  latestFor(worksheetId: string): Invoice | undefined {
    return [...this.invoices()]
      .filter((invoice) => invoice.worksheetId === worksheetId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))[0];
  }

  /**
   * Open invoice of the done lines of a worksheet: one item per line, counted in the unit of its
   * section (fluids: the quantity filled in the worksheet, else 1); labour at the client's hourly rate (`clientRateId`, else the default one), other
   * prices to fill in. A worksheet has at most one open invoice: asking again returns it (shown
   * again, with its data, if the worksheet had been reopened).
   */
  createFromWorksheet(worksheet: Worksheet, sections: TemplateSection[], clientRateId?: string): Invoice {
    const existing = this._invoices().find((invoice) => invoice.worksheetId === worksheet.id && invoice.status === 'open');
    if (existing) {
      if (existing.hidden) this.patch(existing.id, ({ hidden: _hidden, ...invoice }) => invoice);
      return this.getById(existing.id) ?? existing;
    }

    const company = this._company();
    const known = (id: string | undefined) => !!id && !!company?.hourlyRates.some((rate) => rate.id === id);
    const rateId = known(clientRateId) ? clientRateId! : (company?.defaultRateId ?? '');
    const hourlyPrice = company?.hourlyRates.find((rate) => rate.id === rateId)?.price ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    const number = this.nextNumber(today);

    const invoiceSections: InvoiceSection[] = sections.map((section) => ({
      sectionId: section.id,
      items: section.lines.flatMap((line) =>
        Object.keys(worksheet.lines)
          .filter((key) => (key === line.id || key.startsWith(`${line.id}~`)) && worksheet.lines[key].done)
          .map((key): InvoiceItem => {
            const state = worksheet.lines[key];
            const text = line.titleKey ? undefined : String(state.values[line.fields?.[0]?.id ?? ''] ?? '');
            return {
              id: key,
              ...(line.titleKey ? { lineId: line.id } : { text }),
              quantity: (section.invoiceUnit === 'litre' && parseQuantity(state.quantity)) || 1,
              unit: section.invoiceUnit,
              price: section.invoiceUnit === 'hour' ? hourlyPrice : 0,
              discount: 0,
            };
          }),
      ),
    }));

    const invoice: Invoice = {
      id: `inv-${number}`,
      number,
      worksheetId: worksheet.id,
      status: 'open',
      date: today,
      sentOn: null,
      rateId,
      sections: invoiceSections,
    };
    this._invoices.update((list) => [invoice, ...list]);
    return invoice;
  }

  /** The worksheet is reopened: its open invoice is hidden (kept, see `createFromWorksheet`) */
  hideOpenInvoiceOf(worksheetId: string): void {
    this._invoices.update((list) =>
      list.map((invoice) =>
        invoice.worksheetId === worksheetId && invoice.status === 'open' ? { ...invoice, hidden: true } : invoice,
      ),
    );
  }

  /** Sends an open invoice: it becomes read-only and its payment term starts today */
  send(id: string): void {
    const today = new Date().toISOString().slice(0, 10);
    this.patch(id, (invoice) => ({ ...invoice, status: 'sent', sentOn: today }));
  }

  /** A sent invoice has been paid by the client */
  markPaid(id: string): void {
    this.patch(id, (invoice) => ({ ...invoice, status: 'paid' }), 'sent');
  }

  /** Changes the hourly rate: the labour items (counted in hours) take its price */
  setRate(id: string, rateId: string): void {
    const price = this._company()?.hourlyRates.find((rate) => rate.id === rateId)?.price;
    if (price === undefined) return;
    this.patch(id, (invoice) => ({
      ...invoice,
      rateId,
      sections: invoice.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => (item.unit === 'hour' ? { ...item, price } : item)),
      })),
    }));
  }

  /** Shows or hides the observations and tips on the invoice (they are kept) */
  setObservationHidden(id: string, hidden: boolean): void {
    this.patch(id, (invoice) => ({ ...invoice, hideObservation: hidden }));
  }

  updateItem(id: string, sectionId: string, itemId: string, changes: EditableItemFields): void {
    this.patch(id, (invoice) => ({
      ...invoice,
      sections: invoice.sections.map((section) =>
        section.sectionId !== sectionId
          ? section
          : { ...section, items: section.items.map((item) => (item.id === itemId ? { ...item, ...changes } : item)) },
      ),
    }));
  }

  /** Invoice numbers: 2 + yyMMdd of the invoice date (2261025), +1 while already taken */
  private nextNumber(isoDate: string): string {
    const taken = new Set(this._invoices().map((invoice) => invoice.number));
    let number = Number(`2${isoDate.slice(2, 4)}${isoDate.slice(5, 7)}${isoDate.slice(8, 10)}`);
    while (taken.has(String(number))) number++;
    return String(number);
  }

  /** Applies a change to an invoice in the given status (by default only open invoices are edited) */
  private patch(id: string, fn: (invoice: Invoice) => Invoice, status: InvoiceStatus = 'open'): void {
    this._invoices.update((list) =>
      list.map((invoice) => (invoice.id === id && invoice.status === status ? fn(invoice) : invoice)),
    );
  }
}
