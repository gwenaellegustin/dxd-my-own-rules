import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetSettingsStore } from '../../../core/services/worksheet-settings.store';
import { TemplateTextService } from '../../../core/services/template-text.service';
import { VehicleKind } from '../../../core/models/vehicle-brand.model';
import { LineField, LineFieldType, TemplateLine } from '../../../core/models/worksheet-template.model';
import { TextKeyInput } from '../text-key-input/text-key-input';
import { Icon } from '../../../shared/icon/icon';

/** "fields": on the title row; "details": on a second row */
type Slot = 'fields' | 'details';

const FIELD_TYPES: LineFieldType[] = ['text', 'date', 'label', 'radio', 'checkbox'];

/**
 * Editor of the line selected in the preview of the settings page: title (FR / EN) and its fields
 * (add, edit, delete). Lines are reordered in the preview (WorksheetSettingsPage).
 */
@Component({
  selector: 'app-line-editor',
  imports: [NgTemplateOutlet, TranslatePipe, TextKeyInput, Icon],
  templateUrl: './line-editor.html',
  styleUrl: './line-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineEditor {
  private readonly store = inject(WorksheetSettingsStore);
  private readonly texts = inject(TemplateTextService);

  readonly line = input.required<TemplateLine>();
  readonly kind = input.required<VehicleKind>();

  protected readonly slots: Slot[] = ['fields', 'details'];
  protected readonly types = FIELD_TYPES;

  /** The page then edits the first line of the template */
  protected removeLine(): void {
    this.store.removeTemplateLine(this.kind(), this.line().id);
  }

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
    this.update((line) => ({ ...line, [slot]: (line[slot] ?? []).filter((_, i) => i !== index) }));
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
  }

  protected setOptionText(slot: Slot, index: number, field: LineField, value: string, labelKey: string): void {
    this.patchField(slot, index, {
      options: (field.options ?? []).map((option) => (option.value === value ? { ...option, labelKey } : option)),
    });
  }

  private newOption() {
    return { value: `option-${crypto.randomUUID().slice(0, 8)}`, labelKey: this.texts.create('') };
  }

  private update(fn: (line: TemplateLine) => TemplateLine): void {
    this.store.updateTemplateLine(this.kind(), this.line().id, fn);
  }
}
