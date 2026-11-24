import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetSettingsStore } from '../../../core/services/worksheet-settings.store';
import { VehicleKind } from '../../../core/models/vehicle-brand.model';
import { PlanningRule, RuleStatus, TemplateLine } from '../../../core/models/worksheet-template.model';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { Icon } from '../../../shared/icon/icon';

interface TriggerChoice {
  value: string;
  labelKey: string;
}

/** Translation keys of a rule's trigger: the line, and its option ("Any option") if it has some */
interface TriggerLabel {
  lineKey: string;
  optionKey?: string;
}

/**
 * Planning rules of a kind of vehicle (settings page): the list of rules on the left, the selected
 * rule on the right ("when this line is planned / done" and the lines it also marks).
 */
@Component({
  selector: 'app-rules-editor',
  imports: [TranslatePipe, Dropdown, Icon],
  templateUrl: './rules-editor.html',
  styleUrl: './rules-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesEditor {
  protected readonly store = inject(WorksheetSettingsStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  readonly kind = input.required<VehicleKind>();

  /** Lines a rule can use: the titled ones ("Other" lines have no fixed meaning) */
  protected readonly ruleSections = computed(() =>
    (this.store.templateFor(this.kind())?.sections ?? [])
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
      const groups: { label: string; choices: TriggerChoice[] }[] = [];
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
  protected readonly statuses: RuleStatus[] = ['planned', 'done'];

  /** Rule shown on the right: the one clicked in the list, else the first one */
  private readonly selectedId = signal<string | null>(null);
  protected readonly selectedRule = computed(() => {
    const rules = this.rules();
    return rules.find((rule) => rule.id === this.selectedId()) ?? rules[0];
  });

  protected select(rule: PlanningRule): void {
    this.selectedId.set(rule.id);
  }

  protected addRule(): void {
    this.selectedId.set(this.store.addRule(this.kind()).id);
  }

  /** Field whose options can restrict a rule: the first choice field of the line */
  private choiceField(line: TemplateLine) {
    return line.fields?.find((field) => (field.type === 'radio' || field.type === 'checkbox') && field.options?.length);
  }

  private findLine(lineId: string): TemplateLine | undefined {
    return this.ruleSections()
      .flatMap((section) => section.lines)
      .find((line) => line.id === lineId);
  }

  /** Value of the rule in the list: `line`, or `line|field|option` */
  protected triggerValue(rule: PlanningRule): string {
    const value = rule.values?.[0];
    return rule.fieldId && value ? `${rule.lineId}|${rule.fieldId}|${value}` : rule.lineId;
  }

  protected triggerLabel(rule: PlanningRule): TriggerLabel {
    const line = this.findLine(rule.lineId);
    const field = line && this.choiceField(line);
    if (!line || !field) return { lineKey: line?.titleKey ?? '' };
    const option = field.options?.find((o) => rule.fieldId === field.id && o.value === rule.values?.[0]);
    return { lineKey: line.titleKey!, optionKey: option?.labelKey ?? 'settings.anyOption' };
  }

  /** Titles of the lines the rule plans, in the order of the worksheet */
  protected planned(rule: PlanningRule): string[] {
    return this.ruleSections()
      .flatMap((section) => section.lines)
      .filter((line) => rule.plan.includes(line.id))
      .map((line) => line.titleKey!);
  }

  /** The menu opens on the current choice */
  protected openTrigger(menu: Dropdown): void {
    menu.toggle();
    if (!menu.open()) return;
    afterNextRender(
      () => this.host.querySelector<HTMLElement>('.trigger-menu [aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }),
      { injector: this.injector },
    );
  }

  protected changeTrigger(rule: PlanningRule, choice: string, menu: Dropdown): void {
    menu.close();
    const [lineId, fieldId, value] = choice.split('|');
    this.store.updateRule(rule.id, {
      lineId,
      fieldId: fieldId || undefined,
      values: value ? [value] : undefined,
      plan: rule.plan.filter((id) => id !== lineId),
    });
  }

  protected status(rule: PlanningRule): RuleStatus {
    return rule.status ?? 'planned';
  }

  protected setStatus(rule: PlanningRule, status: RuleStatus): void {
    this.store.updateRule(rule.id, { status });
  }

  protected togglePlan(rule: PlanningRule, lineId: string): void {
    const plan = rule.plan.includes(lineId) ? rule.plan.filter((id) => id !== lineId) : [...rule.plan, lineId];
    this.store.updateRule(rule.id, { plan });
  }
}
