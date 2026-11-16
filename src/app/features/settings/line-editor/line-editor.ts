import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { TemplateTextService } from '../../../core/services/template-text.service';
import { VehicleKind } from '../../../core/models/vehicle-brand.model';
import { LineField, LineFieldType, TemplateLine } from '../../../core/models/worksheet-template.model';
import { LineFieldValue, emptyLineState } from '../../../core/models/worksheet.model';
import { TextKeyInput } from '../text-key-input/text-key-input';
import { Icon } from '../../../shared/icon/icon';

/** "fields": on the title row; "details": on a second row */
type Slot = 'fields' | 'details';

const FIELD_TYPES: LineFieldType[] = ['text', 'number', 'date', 'textarea', 'label', 'radio', 'checkbox'];

/**
 * One line of the template on the settings page: title (FR / EN), its fields (add, edit, delete)
 * with their default value in a new worksheet. Dragged by its handle to reorder (WorksheetSettingsPage).
 */
@Component({
  selector: 'app-line-editor',
  imports: [NgTemplateOutlet, TranslatePipe, TextKeyInput, Icon],
  templateUrl: './line-editor.html',
  styleUrl: './line-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineEditor {
  private readonly store = inject(WorksheetStore);
  private readonly texts = inject(TemplateTextService);

  readonly line = input.required<TemplateLine>();
  readonly kind = input.required<VehicleKind>();
  /** The handle is pressed: the parent makes the line draggable */
  readonly dragArm = output<boolean>();

  protected readonly slots: Slot[] = ['fields', 'details'];
  protected readonly types = FIELD_TYPES;

  /** Default values of the line in a new worksheet ("Other" lines have none) */
  protected readonly values = computed(
    () => this.store.templateFor(this.kind())?.defaults[this.line().id]?.values ?? emptyLineState().values,
  );

  protected setTitle(titleKey: string): void {
    this.update((line) => ({ ...line, titleKey }));
  }

  protected addField(slot: Slot, select: HTMLSelectElement): void {
    const type = select.value as LineFieldType;
    select.value = '';
    if (!type) return;
    const field: LineField = { id: `field-${crypto.randomUUID().slice(0, 8)}`, type };
    if (type === 'label') field.labelKey = this.texts.create('…');
    if (type === 'radio' || type === 'checkbox') field.options = [this.newOption(), this.newOption()];
    this.update((line) => ({ ...line, [slot]: [...(line[slot] ?? []), field] }));
  }

  protected removeField(slot: Slot, index: number): void {
    const removed = this.line()[slot]?.[index];
    this.update((line) => ({ ...line, [slot]: (line[slot] ?? []).filter((_, i) => i !== index) }));
    if (removed) this.setDefault(removed.id, null);
  }

  protected patchField(slot: Slot, index: number, changes: Partial<LineField>): void {
    this.update((line) => ({
      ...line,
      [slot]: (line[slot] ?? []).map((field, i) => (i === index ? { ...field, ...changes } : field)),
    }));
  }

  protected addOption(slot: Slot, index: number, field: LineField): void {
    this.patchField(slot, index, { options: [...(field.options ?? []), this.newOption()] });
  }

  protected removeOption(slot: Slot, index: number, field: LineField, value: string): void {
    this.patchField(slot, index, { options: (field.options ?? []).filter((option) => option.value !== value) });
    const current = this.values()[field.id];
    if (Array.isArray(current)) this.setDefault(field.id, current.filter((v) => v !== value));
    else if (current === value) this.setDefault(field.id, null);
  }

  protected setOptionText(slot: Slot, index: number, field: LineField, value: string, labelKey: string): void {
    this.patchField(slot, index, {
      options: (field.options ?? []).map((option) => (option.value === value ? { ...option, labelKey } : option)),
    });
  }

  /** Default choice: a radio holds 0 or 1 value (clicking the selected one clears it) */
  protected toggleDefaultOption(field: LineField, value: string): void {
    const current = this.values()[field.id];
    if (field.type === 'radio') {
      this.setDefault(field.id, current === value ? null : value);
    } else {
      const list = Array.isArray(current) ? current : [];
      this.setDefault(field.id, list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    }
  }

  protected isDefaultOption(field: LineField, value: string): boolean {
    const current = this.values()[field.id];
    return Array.isArray(current) ? current.includes(value) : current === value;
  }

  protected setDefault(fieldId: string, value: LineFieldValue): void {
    if (this.line().repeatable) return;
    this.store.updateDefaultLine(this.kind(), this.line().id, { values: { ...this.values(), [fieldId]: value } });
  }

  protected textValue(fieldId: string): string {
    const value = this.values()[fieldId];
    return typeof value === 'string' ? value : '';
  }

  private newOption() {
    return { value: `option-${crypto.randomUUID().slice(0, 8)}`, labelKey: this.texts.create('') };
  }

  private update(fn: (line: TemplateLine) => TemplateLine): void {
    this.store.updateTemplateLine(this.kind(), this.line().id, fn);
  }
}
