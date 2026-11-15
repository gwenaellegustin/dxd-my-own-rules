import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../../shared/icon/icon';
import { AutoGrow } from '../../../shared/auto-grow/auto-grow';
import { Clearable } from '../../../shared/clearable/clearable';
import { LineField, TemplateLine } from '../../../core/models/worksheet-template.model';
import { LineFieldValue, LineState } from '../../../core/models/worksheet.model';

/**
 * "Line" component of the Figma file (component set "Line", node 3007:6666).
 *
 * Behaviour reproduced from the Figma prototype interactions:
 * - The edit (pencil) button opens the note field. It does not close it.
 * - "Planned" and "Done" toggle independently.
 * - Checking "Done" while the note is open closes the note.
 *   Every other toggle keeps the note open / closed as it was.
 * - Background: default → Planned (planned only) → Done (done, with or without planned).
 */
@Component({
  selector: 'app-task-line',
  imports: [NgTemplateOutlet, TranslatePipe, Icon, AutoGrow, Clearable],
  templateUrl: './task-line.html',
  styleUrl: './task-line.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.line--planned]': 'state().planned && !state().done',
    '[class.line--done]': 'state().done',
  },
})
export class TaskLine implements OnInit {
  readonly line = input.required<TemplateLine>();
  readonly state = input.required<LineState>();
  readonly stateChange = output<Partial<LineState>>();

  protected readonly noteOpen = signal(false);
  protected readonly hasHiddenNote = computed(() => !this.noteOpen() && this.state().note.trim() !== '');

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  ngOnInit(): void {
    // A line that already holds a note shows it when the worksheet is opened
    this.noteOpen.set(this.state().note.trim() !== '');
  }

  protected openNote(): void {
    this.noteOpen.set(true);
    queueMicrotask(() => this.noteField()?.nativeElement.focus());
  }

  protected togglePlanned(): void {
    this.stateChange.emit({ planned: !this.state().planned });
  }

  protected toggleDone(): void {
    const done = !this.state().done;
    if (done) this.noteOpen.set(false);
    this.stateChange.emit({ done });
  }

  protected updateNote(note: string): void {
    this.stateChange.emit({ note });
  }

  protected value(field: LineField): LineFieldValue {
    return this.state().values[field.id] ?? null;
  }

  protected isChecked(field: LineField, option: string): boolean {
    const value = this.value(field);
    return Array.isArray(value) ? value.includes(option) : value === option;
  }

  protected setValue(field: LineField, value: LineFieldValue): void {
    this.stateChange.emit({ values: { ...this.state().values, [field.id]: value } });
  }

  protected toggleOption(field: LineField, option: string): void {
    const current = this.value(field);
    const list = Array.isArray(current) ? current : [];
    this.setValue(field, list.includes(option) ? list.filter((v) => v !== option) : [...list, option]);
  }

  /** Unique name for radio groups (one worksheet is displayed at a time) */
  protected groupName(field: LineField): string {
    return `${this.line().id}__${field.id}`;
  }
}
