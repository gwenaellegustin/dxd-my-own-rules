/** open: being prepared (prices editable) → sent to the client → paid */
export type InvoiceStatus = 'open' | 'sent' | 'paid';

/** How the quantity of an item is counted (and displayed: 1h30, 3.50, 1, Flat rate) */
export type InvoiceUnit = 'hour' | 'litre' | 'piece' | 'flatRate';

export interface InvoiceItem {
  id: string;
  /** Template line the item comes from (its translated title); absent for free text */
  lineId?: string;
  /** Free text ("Other" lines) or details after the title (oil grade, km…) */
  text?: string;
  quantity: number;
  unit: InvoiceUnit;
  /** Unit price, CHF */
  price: number;
  /** Discount in % */
  discount: number;
  /**
   * Note of the worksheet line ("sans les bougies"), copied when the invoice is created and shown
   * under the item; editable while open, or deleted from the invoice (the worksheet keeps it)
   */
  note?: string;
  /** The note is kept (shown dimmed) but not printed nor in the PDF */
  hideNote?: boolean;
}

export interface InvoiceSection {
  /** Template section (Labour, Parts, Fluids, Various) */
  sectionId: string;
  items: InvoiceItem[];
}

/**
 * Invoice of a worksheet. Vehicle, client, kilometers and the observation come from the
 * worksheet (worksheetId), the plate and the address from the client, so they are not repeated.
 */
export interface Invoice {
  id: string;
  number: string;
  worksheetId: string;
  status: InvoiceStatus;
  /** Invoice date (ISO yyyy-MM-dd) */
  date: string;
  /** Date the invoice was sent: start of the payment term; null while open */
  sentOn: string | null;
  /** Hourly rate applied (see Company.hourlyRates) */
  rateId: string;
  sections: InvoiceSection[];
  /** The observations and tips (worksheet comments) are kept but not printed on the invoice */
  hideObservation?: boolean;
  /**
   * Its worksheet was reopened: the invoice is kept (with its data) but not shown; it comes back
   * when the worksheet is invoiced again
   */
  hidden?: boolean;
}

/** Status shown in the app: a sent invoice still unpaid after its due date is overdue */
export type InvoiceShownStatus = InvoiceStatus | 'overdue';

/** Last day to pay (ISO yyyy-MM-dd): date sent + payment term; null while open */
export const dueDate = (invoice: Invoice, paymentTermDays: number): string | null => {
  if (!invoice.sentOn) return null;
  const date = new Date(`${invoice.sentOn}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + paymentTermDays);
  return date.toISOString().slice(0, 10);
};

/** Sent and still not paid the day after its due date (`today`: ISO date, as in InvoiceStore) */
export const shownStatus = (
  invoice: Invoice,
  paymentTermDays: number,
  today = new Date().toISOString().slice(0, 10),
): InvoiceShownStatus => {
  const due = invoice.status === 'sent' ? dueDate(invoice, paymentTermDays) : null;
  return due && today > due ? 'overdue' : invoice.status;
};

/** Amount of an item: quantity × price − discount, rounded to the cent */
export const itemAmount = (item: InvoiceItem): number =>
  Math.round(item.quantity * item.price * (100 - item.discount)) / 100;

/** Swiss rounding of amounts to pay: to the nearest 5 centimes */
export const roundTo5Cents = (amount: number): number => Math.round(amount * 20) / 20;

export interface InvoiceTotals {
  net: number;
  vat: number;
  total: number;
}

export const invoiceTotals = (invoice: Invoice, vatRate: number): InvoiceTotals => {
  const net = invoice.sections.flatMap((section) => section.items).reduce((sum, item) => sum + itemAmount(item), 0);
  const vat = roundTo5Cents((net * vatRate) / 100);
  return { net, vat, total: roundTo5Cents(net + vat) };
};
