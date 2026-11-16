import { Injectable, computed, inject } from '@angular/core';
import { WorksheetStore } from './worksheet.store';
import { InvoiceStore } from './invoice.store';
import { nameKey } from '../utils/names';

/** What is going on with a client (from its worksheets and their invoices) */
export interface ClientActivity {
  /** Latest worksheet or invoice date (yyyy-MM-dd), '' if none */
  lastDate: string;
  openWorksheets: number;
  openInvoices: number;
  /** Sent, not paid yet */
  sentInvoices: number;
}

const NO_ACTIVITY: ClientActivity = { lastDate: '', openWorksheets: 0, openInvoices: 0, sentInvoices: 0 };

/**
 * Activity of each client, computed from the worksheets (which refer to clients by name) and the
 * invoices (through their worksheet). Used to order and badge the client list.
 */
@Injectable({ providedIn: 'root' })
export class ClientActivityService {
  private readonly worksheets = inject(WorksheetStore);
  private readonly invoices = inject(InvoiceStore);

  private readonly byClient = computed(() => {
    const result = new Map<string, ClientActivity>();
    const entry = (clientName: string) => {
      const key = nameKey(clientName);
      if (!result.has(key)) result.set(key, { ...NO_ACTIVITY });
      return result.get(key)!;
    };
    const worksheets = new Map(this.worksheets.worksheets().map((worksheet) => [worksheet.id, worksheet]));
    for (const worksheet of worksheets.values()) {
      const activity = entry(worksheet.client);
      if (worksheet.status === 'open') activity.openWorksheets++;
      if (worksheet.date && worksheet.date > activity.lastDate) activity.lastDate = worksheet.date;
    }
    for (const invoice of this.invoices.invoices()) {
      const worksheet = worksheets.get(invoice.worksheetId);
      if (!worksheet) continue;
      const activity = entry(worksheet.client);
      if (invoice.status === 'open') activity.openInvoices++;
      if (invoice.status === 'sent') activity.sentInvoices++;
      if (invoice.date > activity.lastDate) activity.lastDate = invoice.date;
    }
    return result;
  });

  of(clientName: string): ClientActivity {
    return this.byClient().get(nameKey(clientName)) ?? NO_ACTIVITY;
  }
}
