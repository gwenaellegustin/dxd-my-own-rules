import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { TemplateLine } from '../models/worksheet-template.model';
import { VehicleKind } from '../models/vehicle-brand.model';
import { Damage, LineState, Worksheet, WorksheetStatus, emptyLineState } from '../models/worksheet.model';
import { sameName } from '../utils/names';
import { WorksheetSettingsStore } from './worksheet-settings.store';

/** `typing`: the edit comes from typing in a text field (grouped into one undo step) */
export interface EditOptions {
  typing?: boolean;
}

/** Edits kept in the undo history */
const HISTORY_LIMIT = 100;
/** Keystrokes in the same field closer than this make one undo step */
const TYPING_GROUP_MS = 1000;

/**
 * Holds the worksheets in memory. Edits are kept client-side for the prototype; replace the
 * `update*` methods with API calls once a backend exists. Their lines and default values come
 * from the settings (WorksheetSettingsStore).
 *
 * Every edit is recorded for undo / redo (Ctrl+Z / Ctrl+Y, see WorksheetPage).
 * Typing in one field is grouped into one step, like in a text editor.
 */
@Injectable({ providedIn: 'root' })
export class WorksheetStore {
  private readonly api = inject(ApiService);
  private readonly settings = inject(WorksheetSettingsStore);

  private readonly _worksheets = signal<Worksheet[]>([]);
  private readonly _loaded = signal(false);
  private loading = false;

  /** Previous states of the worksheet list (immutable snapshots), most recent last */
  private readonly undoStack = signal<Worksheet[][]>([]);
  private readonly redoStack = signal<Worksheet[][]>([]);
  /** Last recorded edit, to group typing: field key + time */
  private lastEdit: { key: string; time: number } | null = null;

  readonly worksheets = this._worksheets.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

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
      this._loaded.set(true);
    });
  }

  getById(id: string | null): Worksheet | undefined {
    return this._worksheets().find((worksheet) => worksheet.id === id);
  }

  /** New worksheet: its lines start with the default values of its kind (see settings) */
  create(kind: VehicleKind = 'car'): Worksheet {
    const worksheet: Worksheet = {
      id: crypto.randomUUID(),
      status: 'open',
      kind,
      client: '',
      vehicle: '',
      date: new Date().toISOString().slice(0, 10),
      kilometers: '',
      hours: '',
      comments: '',
      damages: [],
      lines: structuredClone(this.settings.templateFor(kind)?.defaults ?? {}),
    };
    this.record();
    this._worksheets.update((list) => [worksheet, ...list]);
    return worksheet;
  }

  /** Deletes an open worksheet (one undo step); an invoiced one is kept with its invoice */
  remove(id: string): void {
    const target = this.getById(id);
    if (!target || isLocked(target)) return;
    this.record();
    this._worksheets.update((list) => list.filter((worksheet) => worksheet.id !== id));
  }

  update(id: string, changes: Partial<Omit<Worksheet, 'id' | 'lines'>>, options: EditOptions = {}): void {
    const typingKey = options.typing ? `${id}:${Object.keys(changes).sort()}` : undefined;
    this.patch(id, (worksheet) => ({ ...worksheet, ...changes }), typingKey);
    // Once invoiced, the worksheet is locked: undo must not bring it back to open
    if (changes.status === 'invoiced') this.clearHistory();
  }

  /**
   * Observations and tips of the invoice = comments of its (invoiced) worksheet: the only field
   * still editable, from the invoice while it is open
   */
  updateComments(id: string, comments: string): void {
    this.patch(id, (worksheet) => ({ ...worksheet, comments }), undefined, { evenInvoiced: true });
  }

  /** Edits a line; the planning rules of that line then plan their lines (same undo step) */
  updateLine(id: string, lineId: string, changes: Partial<LineState>, options: EditOptions = {}): void {
    const typingKey = options.typing ? `${id}:${lineId}:${Object.keys(changes).sort()}` : undefined;
    this.patch(
      id,
      (worksheet) => {
        const lines = { ...worksheet.lines, [lineId]: { ...this.lineState(worksheet, lineId), ...changes } };
        return { ...worksheet, lines: this.settings.applyRules(worksheet.kind, lineId, lines) };
      },
      typingKey,
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
   * (invoiced ones too, it is not an edit of the worksheet; not recorded for undo).
   * `client`: only the vehicles of this client are renamed.
   */
  rename(field: 'client' | 'vehicle', from: string, to: string, client?: string): void {
    if (!from.trim() || sameName(from, to)) return;
    const matches = (worksheet: Worksheet) =>
      sameName(worksheet[field], from) && (client === undefined || sameName(worksheet.client, client));
    const rename = (list: Worksheet[]) =>
      list.map((worksheet) => (matches(worksheet) ? { ...worksheet, [field]: to } : worksheet));
    this._worksheets.update(rename);
    this.undoStack.update((stack) => stack.map(rename));
    this.redoStack.update((stack) => stack.map(rename));
  }

  /** Restores the state before the last edit */
  undo(): void {
    const previous = this.undoStack().at(-1);
    if (!previous) return;
    this.undoStack.update((stack) => stack.slice(0, -1));
    this.redoStack.update((stack) => [...stack, this._worksheets()]);
    this._worksheets.set(previous);
    this.lastEdit = null;
  }

  /** Re-applies the last undone edit */
  redo(): void {
    const next = this.redoStack().at(-1);
    if (!next) return;
    this.redoStack.update((stack) => stack.slice(0, -1));
    this.undoStack.update((stack) => [...stack, this._worksheets()]);
    this._worksheets.set(next);
    this.lastEdit = null;
  }

  /**
   * Saves the current state before an edit.
   * Typing (`typingKey` = the edited field) extends the current step while it goes on in the same
   * field, instead of adding one step per character; any other edit is always one step.
   */
  private record(typingKey?: string): void {
    const now = Date.now();
    const sameTyping =
      typingKey !== undefined && this.lastEdit?.key === typingKey && now - this.lastEdit.time < TYPING_GROUP_MS;
    this.lastEdit = typingKey !== undefined ? { key: typingKey, time: now } : null;
    this.redoStack.set([]);
    if (sameTyping) return;
    this.undoStack.update((stack) => [...stack, this._worksheets()].slice(-HISTORY_LIMIT));
  }

  private clearHistory(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.lastEdit = null;
  }

  /** Applies an edit; an invoiced worksheet is locked (only `updateComments` may change it) */
  private patch(
    id: string,
    fn: (worksheet: Worksheet) => Worksheet,
    typingKey?: string,
    { evenInvoiced = false } = {},
  ): void {
    const target = this.getById(id);
    if (!target || (isLocked(target) && !evenInvoiced)) return;
    this.record(typingKey);
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
