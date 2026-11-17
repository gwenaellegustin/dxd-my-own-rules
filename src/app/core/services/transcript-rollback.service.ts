import { Injectable, inject } from '@angular/core';
import { TranscriptChange } from '../models/transcript.model';
import { Invoice } from '../models/invoice.model';
import { LineState, Worksheet } from '../models/worksheet.model';
import { ShoppingListItem } from '../models/shopping-list.model';
import { WorksheetStore, isLocked } from './worksheet.store';
import { EditableItemFields, InvoiceStore } from './invoice.store';
import { ShoppingListService } from './shopping-list.service';

/**
 * Where a change of the assistant stands, read from the current data (so it stays right after an
 * undo / redo or a manual edit):
 * - applied: the data holds its new values → it can be rolled back;
 * - rolled-back: the data holds its previous values → it can be applied again;
 * - changed: edited since, neither → left alone;
 * - locked: its worksheet / invoice can no longer be edited (invoiced, sent…).
 */
export type ChangeState = 'applied' | 'rolled-back' | 'changed' | 'locked';

type Values = Record<string, unknown>;

/** Rolls back the changes of the assistant listed in the transcript, and applies them again */
@Injectable({ providedIn: 'root' })
export class TranscriptRollbackService {
  private readonly worksheets = inject(WorksheetStore);
  private readonly invoices = inject(InvoiceStore);
  private readonly shoppingList = inject(ShoppingListService);

  constructor() {
    // The transcript is shown on pages that do not load both (both loads are done once)
    this.worksheets.load();
    this.invoices.load();
  }

  /** null: the change has no raw values, it cannot be rolled back */
  state(change: TranscriptChange): ChangeState | null {
    if (!change.patch) return null;
    const current = this.current(change);
    if (current === undefined) return 'locked';
    if (matches(current, change.patch.after)) return 'applied';
    if (matches(current, change.patch.before)) return 'rolled-back';
    return 'changed';
  }

  /** Back to the values before the change (one undo step on a worksheet) */
  rollback(change: TranscriptChange): void {
    if (this.state(change) === 'applied') this.apply(change, change.patch!.before);
  }

  /** The change again, after a rollback */
  reapply(change: TranscriptChange): void {
    if (this.state(change) === 'rolled-back') this.apply(change, change.patch!.after);
  }

  /**
   * Current values of what the change is about: the worksheet or its line, the invoice item, the
   * shopping-list item (null = not on the list); undefined = it cannot be edited
   */
  private current({ target, area }: TranscriptChange): Values | null | undefined {
    switch (target.type) {
      case 'worksheet': {
        const worksheet = this.worksheets.getById(target.id);
        if (!worksheet || isLocked(worksheet)) return undefined;
        const line = areaKey(area, 'line');
        return line ? toValues(this.worksheets.lineState(worksheet, line)) : toValues(worksheet);
      }
      case 'invoice': {
        const invoice = this.invoices.getById(target.id);
        if (invoice?.status !== 'open') return undefined;
        const found = findItem(invoice, area);
        return found ? toValues(found.item) : undefined;
      }
      case 'shopping-list': {
        const item = this.shoppingList.items().find((candidate) => candidate.id === target.id);
        return item ? toValues(item) : null;
      }
    }
  }

  private apply({ target, area }: TranscriptChange, values: Values | null): void {
    switch (target.type) {
      case 'worksheet': {
        const line = areaKey(area, 'line');
        if (line) this.worksheets.updateLine(target.id, line, values as Partial<LineState>);
        else this.worksheets.update(target.id, values as Partial<Omit<Worksheet, 'id' | 'lines'>>);
        return;
      }
      case 'invoice': {
        const invoice = this.invoices.getById(target.id);
        const found = invoice && findItem(invoice, area);
        if (found) this.invoices.updateItem(target.id, found.sectionId, found.item.id, values as EditableItemFields);
        return;
      }
      case 'shopping-list':
        if (values) this.shoppingList.restore(values as unknown as ShoppingListItem);
        else this.shoppingList.remove(target.id);
        return;
    }
  }
}

/** "line:engineOil" → "engineOil" for the prefix "line"; null for another kind of area */
function areaKey(area: string, prefix: string): string | null {
  return area.startsWith(`${prefix}:`) ? area.slice(prefix.length + 1) : null;
}

/** The invoice item of an area "item:<id>", with its section */
function findItem(invoice: Invoice, area: string) {
  const id = areaKey(area, 'item');
  for (const section of invoice.sections) {
    const item = section.items.find((candidate) => candidate.id === id);
    if (item) return { sectionId: section.sectionId, item };
  }
  return undefined;
}

const toValues = (value: object): Values => value as Values;

/** Each field of `patch` has the same value in `current`; null (shopping list): both not on the list */
function matches(current: Values | null, patch: Values | null): boolean {
  if (current === null || patch === null) return current === patch;
  return Object.keys(patch).every((key) => same(current[key], patch[key]));
}

/** Same value: objects field by field, arrays item by item; empty values (missing, '', []) are equal */
function same(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => same(item, b[i]));
  if (isObject(a) && isObject(b)) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) => same(a[key], b[key]));
  }
  return a === b;
}

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

const isObject = (value: unknown): value is Values => typeof value === 'object' && value !== null && !Array.isArray(value);
