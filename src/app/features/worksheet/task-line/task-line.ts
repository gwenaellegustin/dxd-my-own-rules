import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
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
 * - The note button opens the note field and is hidden while the field is shown.
 *   Free-text lines ("Other", no title) have no note: their text is the note, and a delete
 *   button removes the line instead.
 * - An empty note field closes when it loses focus (click outside).
 * - "Planned" and "Done" toggle independently and never hide the note.
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
  /** "Other" lines: show the delete button */
  readonly removable = input(false);
  readonly remove = output<void>();

  private readonly injector = inject(Injector);

  protected readonly noteOpen = signal(false);
  /** "Other" lines (no title, free text only) cannot have a note */
  protected readonly canHaveNote = computed(() => !!this.line().titleKey);

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  ngOnInit(): void {
    // A line that already holds a note shows it when the worksheet is opened
    this.noteOpen.set(this.state().note.trim() !== '');
  }

  protected openNote(): void {
    this.noteOpen.set(true);
    // The field exists only after the next render
    afterNextRender(() => this.noteField()?.nativeElement.focus(), { injector: this.injector });
  }

  protected closeNoteIfEmpty(): void {
    if (this.state().note.trim() === '') this.noteOpen.set(false);
  }

  protected togglePlanned(): void {
    this.stateChange.emit({ planned: !this.state().planned });
  }

  protected toggleDone(): void {
    this.stateChange.emit({ done: !this.state().done });
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
    const changes: Partial<LineState> = { values: { ...this.state().values, [field.id]: value } };
    // "Other" lines: typing the first text marks the line as planned (it can be unchecked after)
    if (!this.canHaveNote() && !this.state().planned && !this.value(field) && !!value) {
      changes.planned = true;
    }
    this.stateChange.emit(changes);
  }

  /** Radio group: 0 or 1 value. Clicking the selected option clears the group. */
  protected toggleRadio(field: LineField, option: string): void {
    this.setValue(field, this.value(field) === option ? null : option);
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
