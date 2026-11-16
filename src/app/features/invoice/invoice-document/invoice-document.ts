import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { InvoiceFooter } from '../invoice-footer/invoice-footer';
import { AutoGrow } from '../../../shared/auto-grow/auto-grow';
import { BulletList } from '../../../shared/bullet-list/bullet-list';
import { Clearable } from '../../../shared/clearable/clearable';
import { DecimalInput } from '../../../shared/decimal-input/decimal-input';
import { Company } from '../../../core/models/company.model';
import { Address } from '../../../core/models/client.model';
import { Invoice, InvoiceItem, invoiceTotals, itemAmount } from '../../../core/models/invoice.model';
import { TemplateSection } from '../../../core/models/worksheet-template.model';
import { Worksheet } from '../../../core/models/worksheet.model';
import { EditableItemFields } from '../../../core/services/invoice.store';

export interface ItemChange {
  sectionId: string;
  itemId: string;
  changes: EditableItemFields;
}

/** Input step of each editable column, by unit */
const QUANTITY_STEP = { hour: 0.25, litre: 0.1, piece: 1, flatRate: 1 } as const;

/**
 * An invoice laid out like the garage's paper invoice: client, vehicle, one table per section
 * (quantity, price, % discount, amount), totals with VAT, payment term and observation.
 * Open invoices are being prepared: hourly rate, quantities, prices, discounts and observations
 * are editable.
 */
@Component({
  selector: 'app-invoice-document',
  imports: [DatePipe, TranslatePipe, MoneyPipe, AutoGrow, BulletList, Clearable, DecimalInput, InvoiceFooter],
  templateUrl: './invoice-document.html',
  styleUrl: './invoice-document.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDocument {
  readonly invoice = input.required<Invoice>();
  /** Worksheet of the invoice: client, vehicle, kilometers and observation */
  readonly worksheet = input<Worksheet | undefined>();
  readonly company = input.required<Company>();
  /** Template sections: titles of the sections and of their lines */
  readonly sections = input.required<TemplateSection[]>();
  /** Licence plate of the vehicle and address of the client (from the client data) */
  readonly plate = input('');
  readonly address = input<Address | undefined>();

  readonly itemChange = output<ItemChange>();
  /** Hourly rate chosen while the invoice is open */
  readonly rateChange = output<string>();
  /** Observations and tips: the comments of the worksheet */
  readonly observationChange = output<string>();
  /** "Show on the invoice" unchecked: the observations are kept but hidden */
  readonly observationHiddenChange = output<boolean>();

  protected readonly editable = computed(() => this.invoice().status === 'open');
  protected readonly totals = computed(() => invoiceTotals(this.invoice(), this.company().vatRate));
  protected readonly rate = computed(() => this.company().hourlyRates.find((rate) => rate.id === this.invoice().rateId));
  protected readonly quantityStep = QUANTITY_STEP;
  protected readonly amount = itemAmount;

  /** Sections of the invoice that have items, with their template title */
  protected readonly invoiceSections = computed(() =>
    this.invoice()
      .sections.filter((section) => section.items.length > 0)
      .map((section) => ({
        ...section,
        titleKey: this.sections().find((templateSection) => templateSection.id === section.sectionId)?.titleKey ?? '',
      })),
  );

  /** Template line id → title key */
  private readonly lineTitles = computed(
    () => new Map(this.sections().flatMap((section) => section.lines.map((line) => [line.id, line.titleKey] as const))),
  );

  protected titleKey(item: InvoiceItem): string | undefined {
    return item.lineId ? this.lineTitles().get(item.lineId) : undefined;
  }

  /** 1h30 for hours, 3.50 for litres, 1 for pieces; flat rates are labelled in the template */
  protected formatQuantity(item: InvoiceItem): string {
    switch (item.unit) {
      case 'hour': {
        const minutes = Math.round(item.quantity * 60);
        return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
      }
      case 'litre':
        return item.quantity.toFixed(2);
      default:
        return Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(2);
    }
  }

  protected change(sectionId: string, item: InvoiceItem, field: keyof EditableItemFields, event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    // An emptied field counts as 0 (the amount stays readable while typing)
    this.itemChange.emit({ sectionId, itemId: item.id, changes: { [field]: Number.isNaN(value) ? 0 : value } });
  }
}
