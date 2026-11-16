import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../api/api.service';
import { API_ENDPOINTS } from '../api/api.config';
import {
  PlanningRule,
  TemplateLine,
  TemplateSection,
  WorksheetSettings,
  WorksheetTemplate,
} from '../models/worksheet-template.model';
import { VehicleKind } from '../models/vehicle-brand.model';
import {
  Damage,
  LineState,
  Worksheet,
  WorksheetStatus,
  emptyLineState,
} from '../models/worksheet.model';

/**
 * Holds the worksheets and the worksheet settings (template per kind of vehicle, default values
 * of a new worksheet, planning rules) in memory.
 * Edits are kept client-side for the prototype; replace the `update*`
 * methods with API calls once a backend exists.
 *
 * Every edit is recorded for undo / redo (Ctrl+Z / Ctrl+Y, see WorksheetPage).
 * Typing in one field is grouped into one step, like in a text editor.
 */
/** `typing`: the edit comes from typing in a text field (grouped into one undo step) */
export interface EditOptions {
  typing?: boolean;
}

/** Edits kept in the undo history */
const HISTORY_LIMIT = 100;
/** Keystrokes in the same field closer than this make one undo step */
const TYPING_GROUP_MS = 1000;

@Injectable({ providedIn: 'root' })
export class WorksheetStore {
  private readonly api = inject(ApiService);

  private readonly _worksheets = signal<Worksheet[]>([]);
  private readonly _settings = signal<WorksheetSettings | null>(null);
  private readonly _loaded = signal(false);

  /** Previous states of the worksheet list (immutable snapshots), most recent last */
  private readonly undoStack = signal<Worksheet[][]>([]);
  private readonly redoStack = signal<Worksheet[][]>([]);
  /** Last recorded edit, to group typing: field key + time */
  private lastEdit: { key: string; time: number } | null = null;

  readonly worksheets = this._worksheets.asReadonly();
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);
  readonly settings = this._settings.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly byStatus = computed(() => {
    const groups: Record<WorksheetStatus, Worksheet[]> = { open: [], invoiced: [] };
    for (const worksheet of this._worksheets()) groups[worksheet.status].push(worksheet);
    return groups;
  });

  load(): void {
    if (this._loaded()) return;
    forkJoin({
      settings: this.api.get<WorksheetSettings>(API_ENDPOINTS.worksheetSettings),
      worksheets: this.api.get<Worksheet[]>(API_ENDPOINTS.worksheets),
    }).subscribe(({ settings, worksheets }) => {
      this._settings.set(settings);
      this._worksheets.set(worksheets);
      this._loaded.set(true);
    });
  }

  getById(id: string | null): Worksheet | undefined {
    return this._worksheets().find((worksheet) => worksheet.id === id);
  }

  /**
   * Sections with the lines of every template (an invoice shows the items of any worksheet,
   * whatever the kind of its vehicle)
   */
  readonly allSections = computed(() => {
    const sections = new Map<string, TemplateSection>();
    for (const template of this._settings()?.templates ?? []) {
      for (const section of template.sections) {
        const known = sections.get(section.id);
        const lines = known ? [...known.lines, ...section.lines.filter((l) => !known.lines.some((k) => k.id === l.id))] : section.lines;
        sections.set(section.id, { ...section, lines });
      }
    }
    return [...sections.values()];
  });

  /** Template (lines) of a kind of vehicle */
  templateFor(kind: VehicleKind): WorksheetTemplate | undefined {
    return this._settings()?.templates.find((template) => template.kind === kind);
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
      lines: structuredClone(this.templateFor(kind)?.defaults ?? {}),
    };
    this.record();
    this._worksheets.update((list) => [worksheet, ...list]);
    return worksheet;
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
        return { ...worksheet, lines: this.applyRules(worksheet.kind, lineId, lines) };
      },
      typingKey,
    );
  }

  // ----- Settings (edited on the settings page; not part of the worksheet undo history) -----

  /** Default state of a line of new worksheets */
  updateDefaultLine(kind: VehicleKind, lineId: string, changes: Partial<LineState>): void {
    this.patchTemplate(kind, (template) => ({
      ...template,
      defaults: {
        ...template.defaults,
        [lineId]: { ...(template.defaults[lineId] ?? emptyLineState()), ...changes },
      },
    }));
  }

  removeDefaultLine(kind: VehicleKind, lineId: string): void {
    this.patchTemplate(kind, (template) => {
      const { [lineId]: _removed, ...defaults } = template.defaults;
      return { ...template, defaults };
    });
  }

  /** Changes a line of a template (title, fields…) */
  updateTemplateLine(kind: VehicleKind, lineId: string, fn: (line: TemplateLine) => TemplateLine): void {
    this.patchTemplate(kind, (template) => ({
      ...template,
      sections: template.sections.map((section) => ({
        ...section,
        lines: section.lines.map((line) => (line.id === lineId ? fn(line) : line)),
      })),
    }));
  }

  /** Adds a line to a section of a template, at `index` */
  insertTemplateLine(kind: VehicleKind, sectionId: string, index: number, line: TemplateLine): void {
    this.patchTemplate(kind, (template) => ({
      ...template,
      sections: template.sections.map((section) =>
        section.id === sectionId
          ? { ...section, lines: [...section.lines.slice(0, index), line, ...section.lines.slice(index)] }
          : section,
      ),
    }));
  }

  /** Moves a line inside its section (drag and drop of the settings page) */
  moveTemplateLine(kind: VehicleKind, sectionId: string, from: number, to: number): void {
    this.patchTemplate(kind, (template) => ({
      ...template,
      sections: template.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const lines = [...section.lines];
        const [moved] = lines.splice(from, 1);
        lines.splice(to, 0, moved);
        return { ...section, lines };
      }),
    }));
  }

  addRule(kind: VehicleKind): PlanningRule {
    const firstLine = this.templateFor(kind)
      ?.sections.flatMap((section) => section.lines)
      .find((line) => line.titleKey);
    const rule: PlanningRule = { id: crypto.randomUUID(), kind, lineId: firstLine?.id ?? '', plan: [] };
    this.patchSettings((settings) => ({ ...settings, rules: [...settings.rules, rule] }));
    return rule;
  }

  updateRule(id: string, changes: Partial<Omit<PlanningRule, 'id' | 'kind'>>): void {
    this.patchSettings((settings) => ({
      ...settings,
      rules: settings.rules.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)),
    }));
  }

  removeRule(id: string): void {
    this.patchSettings((settings) => ({ ...settings, rules: settings.rules.filter((rule) => rule.id !== id) }));
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
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    if (!from.trim() || same(from, to)) return;
    const matches = (worksheet: Worksheet) =>
      same(worksheet[field], from) && (client === undefined || same(worksheet.client, client));
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

  /**
   * Rules triggered by the edited line (`lineId`, an instance key): when it is planned and its
   * field matches, the rule's lines are planned (never unplanned: they can be unchecked after)
   */
  private applyRules(kind: VehicleKind, lineId: string, lines: Record<string, LineState>): Record<string, LineState> {
    const baseId = lineId.split('~')[0];
    const trigger = lines[lineId];
    if (!trigger?.planned) return lines;
    const matches = (rule: PlanningRule) =>
      rule.kind === kind &&
      rule.lineId === baseId &&
      (!rule.fieldId || (rule.values ?? []).includes(String(trigger.values[rule.fieldId] ?? '')));
    const result = { ...lines };
    for (const rule of this._settings()?.rules.filter(matches) ?? []) {
      for (const target of rule.plan) {
        const state = result[target] ?? emptyLineState();
        if (!state.planned) result[target] = { ...state, planned: true };
      }
    }
    return result;
  }

  private patchTemplate(kind: VehicleKind, fn: (template: WorksheetTemplate) => WorksheetTemplate): void {
    this.patchSettings((settings) => ({
      ...settings,
      templates: settings.templates.map((template) => (template.kind === kind ? fn(template) : template)),
    }));
  }

  private patchSettings(fn: (settings: WorksheetSettings) => WorksheetSettings): void {
    this._settings.update((settings) => (settings ? fn(settings) : settings));
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
export function lineInstanceIds(lines: Record<string, LineState>, line: TemplateLine, locked = false): string[] {
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
