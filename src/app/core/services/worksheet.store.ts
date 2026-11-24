import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { TemplateLine } from '../models/worksheet-template.model';
import { VehicleKind } from '../models/vehicle-brand.model';
import { CarryOverRef, Damage, LineState, Worksheet, WorksheetStatus, emptyLineState } from '../models/worksheet.model';
import { sameName } from '../utils/names';
import { WorksheetSettingsStore } from './worksheet-settings.store';
import { UndoService } from './undo.service';

/**
 * Holds the worksheets in memory. Edits are kept client-side for the prototype; replace the
 * `update*` methods with API calls once a backend exists. Their lines and default values come
 * from the settings (WorksheetSettingsStore).
 *
 * Every edit is recorded for undo / redo (see UndoService).
 */
@Injectable({ providedIn: 'root' })
export class WorksheetStore {
  private readonly api = inject(ApiService);
  private readonly settings = inject(WorksheetSettingsStore);
  private readonly history = inject(UndoService);

  private readonly _worksheets = signal<Worksheet[]>([]);
  private readonly _loaded = signal(false);
  private loading = false;

  /** Worksheets created and not edited yet: dropped when left (see `discardIfUntouched`) */
  private readonly untouched = new Set<string>();
  /** Worksheets whose carried-over proposal was answered or closed: not proposed again */
  private readonly carryOverAnswered = signal<ReadonlySet<string>>(new Set());

  readonly worksheets = this._worksheets.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly byStatus = computed(() => {
    const groups: Record<WorksheetStatus, Worksheet[]> = { open: [], invoiced: [] };
    for (const worksheet of this._worksheets()) groups[worksheet.status].push(worksheet);
    return groups;
  });

  /** Loads the worksheets and their settings (once) */
  load(): void {
    this.settings.load();
    if (this.loading) return;
    this.loading = true;
    this.api.get<Worksheet[]>(API_ENDPOINTS.worksheets).subscribe((worksheets) => {
      this._worksheets.set(worksheets);
      this.history.track(this._worksheets);
      this._loaded.set(true);
    });
  }

  getById(id: string | null): Worksheet | undefined {
    return this._worksheets().find((worksheet) => worksheet.id === id);
  }

  /**
   * New worksheet of a kind of vehicle (its lines come from the settings, all empty); `from`:
   * already for a client / vehicle (e.g. from the client page)
   */
  create(kind: VehicleKind = 'car', from: Partial<Pick<Worksheet, 'client' | 'vehicle'>> = {}): Worksheet {
    const worksheet: Worksheet = {
      id: crypto.randomUUID(),
      status: 'open',
      kind,
      client: from.client ?? '',
      vehicle: from.vehicle ?? '',
      date: new Date().toISOString().slice(0, 10),
      kilometers: '',
      hours: '',
      comments: '',
      damages: [],
      lines: {},
    };
    this.history.record();
    this._worksheets.update((list) => [worksheet, ...list]);
    this.untouched.add(worksheet.id);
    return worksheet;
  }

  /** A new worksheet left without any edit is removed silently (nothing to keep, no undo step) */
  discardIfUntouched(id: string): void {
    if (!this.untouched.delete(id)) return;
    this._worksheets.update((list) => list.filter((worksheet) => worksheet.id !== id));
  }

  /** Deletes an open worksheet (one undo step); an invoiced one is kept with its invoice */
  remove(id: string): void {
    const target = this.getById(id);
    if (!target || isLocked(target)) return;
    this.history.record();
    this._worksheets.update((list) => list.filter((worksheet) => worksheet.id !== id));
  }

  update(id: string, changes: Partial<Omit<Worksheet, 'id' | 'lines'>>): void {
    this.patch(id, (worksheet) => ({ ...worksheet, ...changes }));
    // Once invoiced, the worksheet is locked: undo must not bring it back to open
    if (changes.status === 'invoiced') this.history.clear();
  }

  /**
   * An invoiced worksheet can be edited again (its open invoice is hidden, see
   * InvoiceStore.hideOpenInvoiceOf). Like invoicing, it clears the undo history.
   */
  reopen(id: string): void {
    this.patch(id, (worksheet) => ({ ...worksheet, status: 'open' }), { evenInvoiced: true });
    this.history.clear();
  }

  /**
   * Observations and tips of the invoice = comments of its (invoiced) worksheet: the only field
   * still editable, from the invoice while it is open
   */
  updateComments(id: string, comments: string): void {
    this.patch(id, (worksheet) => ({ ...worksheet, comments }), { evenInvoiced: true });
  }

  /** Edits a line; the planning rules of that line then plan their lines (same undo step) */
  updateLine(id: string, lineId: string, changes: Partial<LineState>): void {
    this.patch(id, (worksheet) => {
      const lines = { ...worksheet.lines, [lineId]: { ...this.lineState(worksheet, lineId), ...changes } };
      return { ...worksheet, lines: this.settings.applyRules(worksheet.kind, lineId, lines) };
    });
  }

  /**
   * Earlier invoiced worksheets of the same vehicle (same client) that still carry lines over to
   * the next intervention, newest first; none once the proposal was answered for `worksheet`
   */
  pendingCarryOver(worksheet: Worksheet): Worksheet[] {
    if (isLocked(worksheet) || !worksheet.client.trim() || !worksheet.vehicle.trim()) return [];
    if (this.carryOverAnswered().has(worksheet.id)) return [];
    return (
      this._worksheets()
        .filter(
          (other) =>
            other.id !== worksheet.id &&
            isLocked(other) &&
            !!other.carryOver?.length &&
            other.kind === worksheet.kind &&
            sameName(other.client, worksheet.client) &&
            sameName(other.vehicle, worksheet.vehicle) &&
            (!worksheet.date || !other.date || other.date <= worksheet.date),
        )
        // Stable sort: the list order (newest first) is kept for equal dates
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    );
  }

  /**
   * Answer to the carried-over proposal of worksheet `id` (not proposed again in this session):
   * - `imported` lines are added to it (planned, not done; their quantity is not kept), a
   *   repeatable line ("Other") as a new instance after the existing ones;
   * - `imported` and `deleted` lines are no longer carried over by their source worksheet;
   * - the others stay carried over, proposed again for the next worksheet.
   * One undo step (it may change several worksheets).
   */
  answerCarryOver(id: string, imported: CarryOverRef[], deleted: CarryOverRef[]): void {
    this.carryOverAnswered.update((current) => new Set(current).add(id));
    const target = this.getById(id);
    if (!target || isLocked(target) || (!imported.length && !deleted.length)) return;

    const templateLines = this.settings.templateFor(target.kind)?.sections.flatMap((section) => section.lines) ?? [];
    const lines = { ...target.lines };
    for (const { sourceId, key } of imported) {
      const state = this.getById(sourceId)?.lines[key];
      const line = templateLines.find((candidate) => candidate.id === key.split('~')[0]);
      if (!state || !line) continue;
      const lineKey = line.repeatable ? lineInstanceIds(lines, line).at(-1)! : line.id;
      const { quantity: _quantity, ...kept } = state;
      lines[lineKey] = { ...kept, planned: true, done: false };
    }

    const handled = [...imported, ...deleted];
    const isHandled = (worksheet: Worksheet, key: string) =>
      handled.some((ref) => ref.sourceId === worksheet.id && ref.key === key);
    this.untouched.delete(id);
    this.history.record();
    this._worksheets.update((list) =>
      list.map((worksheet) => {
        if (worksheet.id === id) return { ...worksheet, lines };
        if (!worksheet.carryOver?.some((key) => isHandled(worksheet, key))) return worksheet;
        return { ...worksheet, carryOver: worksheet.carryOver.filter((key) => !isHandled(worksheet, key)) };
      }),
    );
  }

  /** Removes a line instance (repeatable "Other" lines) */
  removeLine(id: string, lineId: string): void {
    this.patch(id, (worksheet) => {
      const { [lineId]: _removed, ...lines } = worksheet.lines;
      return { ...worksheet, lines };
    });
  }

  addDamage(id: string, damage: Damage): void {
    this.patch(id, (worksheet) => ({ ...worksheet, damages: [...worksheet.damages, damage] }));
  }

  removeDamage(id: string, index: number): void {
    this.patch(id, (worksheet) => ({
      ...worksheet,
      damages: worksheet.damages.filter((_, i) => i !== index),
    }));
  }

  lineState(worksheet: Worksheet, lineId: string): LineState {
    return worksheet.lines[lineId] ?? emptyLineState();
  }

  /**
   * State keys under which a template line is displayed.
   * A repeatable line ("Other") shows every stored instance (`id`, `id~2`, `id~3`…)
   * plus a trailing empty one to type a new line.
   * A stored instance whose text was cleared stays in place (it is removed when its field
   * loses focus while empty, see TaskLine), so clearing never makes a line disappear.
   * An invoiced worksheet is locked: no empty line to type a new one.
   */
  lineInstanceIds(worksheet: Worksheet, line: TemplateLine): string[] {
    return lineInstanceIds(worksheet.lines, line, isLocked(worksheet));
  }

  /**
   * A client or vehicle file was renamed: worksheets refer to them by name, so they follow
   * (invoiced ones too, it is not an edit of the worksheet). Not an undo step of its own: it
   * follows the rename, so undoing the rename puts the worksheets back too.
   * `client`: only the vehicles of this client are renamed.
   */
  rename(field: 'client' | 'vehicle', from: string, to: string, client?: string): void {
    if (!from.trim() || sameName(from, to)) return;
    const matches = (worksheet: Worksheet) =>
      sameName(worksheet[field], from) && (client === undefined || sameName(worksheet.client, client));
    this._worksheets.update((list) =>
      list.map((worksheet) => (matches(worksheet) ? { ...worksheet, [field]: to } : worksheet)),
    );
  }

  /** Applies an edit (one undo step); an invoiced worksheet is locked (only `updateComments` may change it) */
  private patch(id: string, fn: (worksheet: Worksheet) => Worksheet, { evenInvoiced = false } = {}): void {
    const target = this.getById(id);
    if (!target || (isLocked(target) && !evenInvoiced)) return;
    this.untouched.delete(id);
    this.history.record();
    this._worksheets.update((list) => list.map((worksheet) => (worksheet.id === id ? fn(worksheet) : worksheet)));
  }
}

/** Keys of the instances of a line in `lines` (see WorksheetStore.lineInstanceIds) */
function lineInstanceIds(lines: Record<string, LineState>, line: TemplateLine, locked = false): string[] {
  if (!line.repeatable) return [line.id];
  const index = (key: string) => (key === line.id ? 1 : Number(key.slice(line.id.length + 1)));
  const ids = Object.keys(lines)
    .filter((key) => key === line.id || (key.startsWith(`${line.id}~`) && index(key) > 1))
    .sort((a, b) => index(a) - index(b));
  if (ids.length === 0) return locked ? [] : [line.id];
  return locked ? ids : [...ids, `${line.id}~${index(ids[ids.length - 1]) + 1}`];
}

/** An invoiced worksheet can no longer be edited */
export const isLocked = (worksheet: Worksheet): boolean => worksheet.status === 'invoiced';
