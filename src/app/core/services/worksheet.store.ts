import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import { TemplateLine, WorksheetTemplate } from '../models/worksheet-template.model';
import {
  Damage,
  LineState,
  Worksheet,
  WorksheetStatus,
  emptyLineState,
} from '../models/worksheet.model';

/**
 * Holds the worksheets and the worksheet template in memory.
 * Edits are kept client-side for the prototype; replace the `update*`
 * methods with API calls once a backend exists.
 *
 * Every edit is recorded for undo / redo (Ctrl+Z / Ctrl+Y, see WorksheetPage).
 * Typing in one field is grouped into one step, like in a text editor.
 */
/** Edits kept in the undo history */
const HISTORY_LIMIT = 100;
/** Keystrokes in the same field closer than this make one undo step */
const TYPING_GROUP_MS = 1000;

@Injectable({ providedIn: 'root' })
export class WorksheetStore {
  private readonly api = inject(ApiService);

  private readonly _worksheets = signal<Worksheet[]>([]);
  private readonly _template = signal<WorksheetTemplate | null>(null);
  private readonly _loaded = signal(false);

  /** Previous states of the worksheet list (immutable snapshots), most recent last */
  private readonly undoStack = signal<Worksheet[][]>([]);
  private readonly redoStack = signal<Worksheet[][]>([]);
  /** Last recorded edit, to group typing: field key + time */
  private lastEdit: { key: string; time: number } | null = null;

  readonly worksheets = this._worksheets.asReadonly();
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);
  readonly template = this._template.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly byStatus = computed(() => {
    const groups: Record<WorksheetStatus, Worksheet[]> = { open: [], toBeBilled: [], invoiced: [] };
    for (const worksheet of this._worksheets()) groups[worksheet.status].push(worksheet);
    return groups;
  });

  load(): void {
    if (this._loaded()) return;
    forkJoin({
      template: this.api.get<WorksheetTemplate>(API_ENDPOINTS.worksheetTemplate),
      worksheets: this.api.get<Worksheet[]>(API_ENDPOINTS.worksheets),
    }).subscribe(({ template, worksheets }) => {
      this._template.set(template);
      this._worksheets.set(worksheets);
      this._loaded.set(true);
    });
  }

  getById(id: string | null): Worksheet | undefined {
    return this._worksheets().find((worksheet) => worksheet.id === id);
  }

  create(): Worksheet {
    const worksheet: Worksheet = {
      id: crypto.randomUUID(),
      status: 'open',
      client: '',
      vehicle: '',
      registrationImage: null,
      registrationNote: '',
      date: new Date().toISOString().slice(0, 10),
      kilometers: '',
      hours: '',
      comments: '',
      damages: [],
      lines: {},
    };
    this.record('create');
    this._worksheets.update((list) => [worksheet, ...list]);
    return worksheet;
  }

  update(id: string, changes: Partial<Omit<Worksheet, 'id' | 'lines'>>): void {
    this.patch(id, (worksheet) => ({ ...worksheet, ...changes }), `${id}:${Object.keys(changes).sort()}`);
  }

  updateLine(id: string, lineId: string, changes: Partial<LineState>): void {
    this.patch(
      id,
      (worksheet) => ({
        ...worksheet,
        lines: {
          ...worksheet.lines,
          [lineId]: { ...this.lineState(worksheet, lineId), ...changes },
        },
      }),
      `${id}:${lineId}:${Object.keys(changes).sort()}`,
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
   */
  lineInstanceIds(worksheet: Worksheet, line: TemplateLine): string[] {
    if (!line.repeatable) return [line.id];
    const index = (key: string) => (key === line.id ? 1 : Number(key.slice(line.id.length + 1)));
    const ids = Object.keys(worksheet.lines)
      .filter((key) => key === line.id || (key.startsWith(`${line.id}~`) && index(key) > 1))
      .sort((a, b) => index(a) - index(b));
    if (ids.length === 0) return [line.id];
    return [...ids, `${line.id}~${index(ids[ids.length - 1]) + 1}`];
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
   * Typing in a text field (same field, keystrokes close together) extends the current step
   * instead of adding one per character; clicks (checkbox, radio, button) are always one step.
   */
  private record(key: string): void {
    const now = Date.now();
    const typing = isTyping();
    const sameTyping = typing && this.lastEdit?.key === key && now - this.lastEdit.time < TYPING_GROUP_MS;
    this.lastEdit = typing ? { key, time: now } : null;
    this.redoStack.set([]);
    if (sameTyping) return;
    this.undoStack.update((stack) => [...stack, this._worksheets()].slice(-HISTORY_LIMIT));
  }

  private patch(id: string, fn: (worksheet: Worksheet) => Worksheet, key = 'edit'): void {
    this.record(key);
    this._worksheets.update((list) => list.map((worksheet) => (worksheet.id === id ? fn(worksheet) : worksheet)));
  }
}

/** True when the edit comes from typing in a text field (not a checkbox / radio / button) */
function isTyping(): boolean {
  const element = document.activeElement;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(element.type);
}
