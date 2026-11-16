import { Injectable, computed, inject, signal } from '@angular/core';
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
import { LineState, emptyLineState } from '../models/worksheet.model';

/**
 * Worksheet settings (`worksheet-settings.json`): the lines of the worksheets of each kind of
 * vehicle and the planning rules. Edited on the settings
 * page, kept in memory (not part of the worksheet undo history).
 */
@Injectable({ providedIn: 'root' })
export class WorksheetSettingsStore {
  private readonly api = inject(ApiService);

  private readonly _settings = signal<WorksheetSettings | null>(null);
  private loading = false;

  readonly settings = this._settings.asReadonly();

  /**
   * Sections with the lines of every template (an invoice shows the items of any worksheet,
   * whatever the kind of its vehicle)
   */
  readonly allSections = computed(() => {
    const sections = new Map<string, TemplateSection>();
    for (const template of this._settings()?.templates ?? []) {
      for (const section of template.sections) {
        const known = sections.get(section.id)?.lines ?? [];
        const added = section.lines.filter((line) => !known.some((k) => k.id === line.id));
        sections.set(section.id, { ...section, lines: [...known, ...added] });
      }
    }
    return [...sections.values()];
  });

  load(): void {
    if (this.loading) return;
    this.loading = true;
    this.api.get<WorksheetSettings>(API_ENDPOINTS.worksheetSettings).subscribe((settings) => this._settings.set(settings));
  }

  /** Template (lines) of a kind of vehicle */
  templateFor(kind: VehicleKind): WorksheetTemplate | undefined {
    return this._settings()?.templates.find((template) => template.kind === kind);
  }

  rulesFor(kind: VehicleKind): PlanningRule[] {
    return (this._settings()?.rules ?? []).filter((rule) => rule.kind === kind);
  }

  /**
   * Rules triggered by the edited line (`lineId`, an instance key): when it is planned (or done,
   * depending on the rule) and its field matches, the rule's lines are planned (or done) too; never
   * the other way round: they can be unchecked after
   */
  applyRules(kind: VehicleKind, lineId: string, lines: Record<string, LineState>): Record<string, LineState> {
    const baseId = lineId.split('~')[0];
    const trigger = lines[lineId];
    if (!trigger) return lines;
    const matches = (rule: PlanningRule) =>
      rule.lineId === baseId &&
      trigger[rule.status ?? 'planned'] &&
      (!rule.fieldId || (rule.values ?? []).includes(String(trigger.values[rule.fieldId] ?? '')));
    const result = { ...lines };
    for (const rule of this.rulesFor(kind).filter(matches)) {
      const status = rule.status ?? 'planned';
      for (const target of rule.plan) {
        const state = result[target] ?? emptyLineState();
        if (!state[status]) result[target] = { ...state, [status]: true };
      }
    }
    return result;
  }

  // ----- Lines of a template -----

  /** Changes a line of a template (title, fields…) */
  updateTemplateLine(kind: VehicleKind, lineId: string, fn: (line: TemplateLine) => TemplateLine): void {
    this.patchSections(kind, (section) => ({
      ...section,
      lines: section.lines.map((line) => (line.id === lineId ? fn(line) : line)),
    }));
  }

  /** Adds a line to a section of a template, at `index` */
  insertTemplateLine(kind: VehicleKind, sectionId: string, index: number, line: TemplateLine): void {
    this.patchSections(kind, (section) =>
      section.id === sectionId
        ? { ...section, lines: [...section.lines.slice(0, index), line, ...section.lines.slice(index)] }
        : section,
    );
  }

  /**
   * Deletes a line of a template, and its use in the planning rules (rules triggered by it are
   * removed). Worksheets keep their values but no longer show the line.
   */
  removeTemplateLine(kind: VehicleKind, lineId: string): void {
    this.patchSections(kind, (section) => ({ ...section, lines: section.lines.filter((line) => line.id !== lineId) }));
    this.patch((settings) => ({
      ...settings,
      rules: settings.rules
        .filter((rule) => rule.kind !== kind || rule.lineId !== lineId)
        .map((rule) => (rule.kind === kind ? { ...rule, plan: rule.plan.filter((id) => id !== lineId) } : rule)),
    }));
  }

  /** Moves a line inside its section (drag and drop of the settings page) */
  moveTemplateLine(kind: VehicleKind, sectionId: string, from: number, to: number): void {
    this.patchSections(kind, (section) => {
      if (section.id !== sectionId) return section;
      const lines = [...section.lines];
      const [moved] = lines.splice(from, 1);
      lines.splice(to, 0, moved);
      return { ...section, lines };
    });
  }

  // ----- Planning rules -----

  /** New rule, on the first titled line of the template ("Other" lines have no fixed meaning) */
  addRule(kind: VehicleKind): PlanningRule {
    const firstLine = this.templateFor(kind)
      ?.sections.flatMap((section) => section.lines)
      .find((line) => line.titleKey);
    const rule: PlanningRule = { id: crypto.randomUUID(), kind, lineId: firstLine?.id ?? '', plan: [] };
    this.patch((settings) => ({ ...settings, rules: [...settings.rules, rule] }));
    return rule;
  }

  updateRule(id: string, changes: Partial<Omit<PlanningRule, 'id' | 'kind'>>): void {
    this.patch((settings) => ({
      ...settings,
      rules: settings.rules.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)),
    }));
  }

  removeRule(id: string): void {
    this.patch((settings) => ({ ...settings, rules: settings.rules.filter((rule) => rule.id !== id) }));
  }

  private patchSections(kind: VehicleKind, fn: (section: TemplateSection) => TemplateSection): void {
    this.patchTemplate(kind, (template) => ({ ...template, sections: template.sections.map(fn) }));
  }

  private patchTemplate(kind: VehicleKind, fn: (template: WorksheetTemplate) => WorksheetTemplate): void {
    this.patch((settings) => ({
      ...settings,
      templates: settings.templates.map((template) => (template.kind === kind ? fn(template) : template)),
    }));
  }

  private patch(fn: (settings: WorksheetSettings) => WorksheetSettings): void {
    this._settings.update((settings) => (settings ? fn(settings) : settings));
  }
}
