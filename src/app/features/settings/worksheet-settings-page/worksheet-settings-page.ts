import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { WorksheetSettingsStore } from '../../../core/services/worksheet-settings.store';
import { VehicleKind } from '../../../core/models/vehicle-brand.model';
import { PlanningRule, TemplateLine } from '../../../core/models/worksheet-template.model';
import { LineEditor } from '../line-editor/line-editor';
import { TaskLine } from '../../worksheet/task-line/task-line';
import { LineState, emptyLineState } from '../../../core/models/worksheet.model';
import { TemplateTextService } from '../../../core/services/template-text.service';
import { Icon } from '../../../shared/icon/icon';

type SettingsTab = 'defaults' | 'rules';

/**
 * Worksheet settings (account menu), per kind of vehicle (car / motorcycle):
 * - Default values: the state of the lines of a new worksheet (planned, values, notes).
 * - Planning rules: "when this line is planned (with these options), also plan those lines".
 * Kept in memory like the rest of the prototype (WorksheetSettingsStore).
 */
@Component({
  selector: 'app-worksheet-settings-page',
  imports: [NgTemplateOutlet, TranslatePipe, LineEditor, TaskLine, Icon],
  templateUrl: './worksheet-settings-page.html',
  styleUrl: './worksheet-settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetSettingsPage {
  protected readonly store = inject(WorksheetSettingsStore);

  protected readonly kinds: VehicleKind[] = ['car', 'motorcycle'];
  protected readonly tabs: SettingsTab[] = ['defaults', 'rules'];
  protected readonly kind = signal<VehicleKind>('car');
  protected readonly tab = signal<SettingsTab>('defaults');

  protected readonly template = computed(() => this.store.templateFor(this.kind()));

  /** Lines a rule can use: the titled ones ("Other" lines have no fixed meaning) */
  protected readonly ruleSections = computed(() =>
    (this.template()?.sections ?? [])
      .map((section) => ({ ...section, lines: section.lines.filter((line) => line.titleKey) }))
      .filter((section) => section.lines.length > 0),
  );

  /**
   * Choices of the "When this line is planned" list: one group per section for the lines without
   * options, and one group per line with options (its options, or any of them)
   */
  protected readonly triggerGroups = computed(() =>
    this.ruleSections().flatMap((section) => {
      const plain = section.lines.filter((line) => !this.choiceField(line));
      const groups: { label: string; choices: { value: string; labelKey: string }[] }[] = [];
      if (plain.length) {
        groups.push({ label: section.titleKey, choices: plain.map((line) => ({ value: line.id, labelKey: line.titleKey! })) });
      }
      for (const line of section.lines) {
        const field = this.choiceField(line);
        if (!field) continue;
        groups.push({
          label: line.titleKey!,
          choices: [
            ...field.options!.map((option) => ({ value: `${line.id}|${field.id}|${option.value}`, labelKey: option.labelKey })),
            { value: line.id, labelKey: 'settings.anyOption' },
          ],
        });
      }
      return groups;
    }),
  );

  protected readonly rules = computed(() => this.store.rulesFor(this.kind()));

  /** Line whose handle is pressed (only it can be dragged, not from its inputs) */
  protected readonly armed = signal<string | null>(null);
  /** Line being dragged, and where it would be dropped */
  protected readonly drag = signal<{ sectionId: string; lineId: string; from: number } | null>(null);
  protected readonly dropAt = signal<{ sectionId: string; index: number } | null>(null);

  private readonly texts = inject(TemplateTextService);

  constructor() {
    // Settings and the worksheets that use them
    inject(WorksheetStore).load();
    // Texts are edited in every language at once
    this.texts.load();
  }

  /** New line (title to fill, no field yet) inserted at `index` of the section */
  protected addLine(sectionId: string, index: number): void {
    const titleKey = this.texts.create('');
    this.store.insertTemplateLine(this.kind(), sectionId, index, { id: `line-${crypto.randomUUID().slice(0, 8)}`, titleKey });
  }

  /** State of a line in a new worksheet, for its preview */
  protected defaultState(lineId: string): LineState {
    return this.template()?.defaults[lineId] ?? emptyLineState();
  }

  protected startDrag(event: DragEvent, sectionId: string, lineId: string, from: number): void {
    event.dataTransfer?.setData('text/plain', lineId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.drag.set({ sectionId, lineId, from });
  }

  /** Over the top half of a line: dropped before it, else after it (same section only) */
  protected dragOver(event: DragEvent, sectionId: string, index: number): void {
    if (this.drag()?.sectionId !== sectionId) return;
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    this.dropAt.set({ sectionId, index: index + (after ? 1 : 0) });
  }

  protected isDropTarget(sectionId: string, index: number, side: 'before' | 'after'): boolean {
    const at = this.dropAt();
    const drag = this.drag();
    if (!at || !drag || at.sectionId !== sectionId || at.index === drag.from || at.index === drag.from + 1) return false;
    return side === 'before' ? at.index === index : at.index === index + 1;
  }

  protected dropLine(event: DragEvent, sectionId: string): void {
    event.preventDefault();
    const drag = this.drag();
    const at = this.dropAt();
    if (drag && at && at.sectionId === sectionId) {
      const to = at.index > drag.from ? at.index - 1 : at.index;
      if (to !== drag.from) this.store.moveTemplateLine(this.kind(), sectionId, drag.from, to);
    }
    this.endDrag();
  }

  protected endDrag(): void {
    this.drag.set(null);
    this.dropAt.set(null);
    this.armed.set(null);
  }

  /** Field whose options can restrict a rule: the first choice field of the line */
  private choiceField(line: TemplateLine) {
    return line.fields?.find((field) => (field.type === 'radio' || field.type === 'checkbox') && field.options?.length);
  }

  /** Value of the rule in the list: `line`, or `line|field|option` */
  protected triggerValue(rule: PlanningRule): string {
    const value = rule.values?.[0];
    return rule.fieldId && value ? `${rule.lineId}|${rule.fieldId}|${value}` : rule.lineId;
  }

  protected changeTrigger(rule: PlanningRule, choice: string): void {
    const [lineId, fieldId, value] = choice.split('|');
    this.store.updateRule(rule.id, {
      lineId,
      fieldId: fieldId || undefined,
      values: value ? [value] : undefined,
      plan: rule.plan.filter((id) => id !== lineId),
    });
  }

  protected togglePlan(rule: PlanningRule, lineId: string): void {
    const plan = rule.plan.includes(lineId) ? rule.plan.filter((id) => id !== lineId) : [...rule.plan, lineId];
    this.store.updateRule(rule.id, { plan });
  }
}
