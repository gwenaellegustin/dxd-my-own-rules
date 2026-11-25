import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../../shared/icon/icon';
import { AutoGrow } from '../../../shared/auto-grow/auto-grow';
import { Clearable } from '../../../shared/clearable/clearable';
import { LineField, TemplateLine } from '../../../core/models/worksheet-template.model';
import { LineFieldValue, LineState, hasLineValues } from '../../../core/models/worksheet.model';

/** Wait after a click on the line: a second click within it makes a double click (Done only) */
const DOUBLE_CLICK_DELAY = 250;

/** What a click on the line must leave alone: its fields, options, buttons and links */
const CONTROLS = 'input, textarea, select, button, label, a';

/**
 * A new colour spreads from where the line was pressed if it changes within this time (a click
 * on the line toggles "Planned" after DOUBLE_CLICK_DELAY); later changes (undo, transcript,
 * keyboard) keep the plain colour transition
 */
const REVEAL_WINDOW = 800;

/**
 * "Line" component of the Figma file (component set "Line", node 3007:6666).
 *
 * Behaviour reproduced from the Figma prototype interactions:
 * - The note button opens the note field and is hidden while the field is shown.
 *   Free-text lines ("Other", no title) have no note: their text is the note, and a delete
 *   button removes the line instead.
 * - An empty note field closes when it loses focus (click outside).
 * - "Planned" and "Done" toggle independently and never hide the note.
 * - A click on the line itself (not on a field, an option or a button) toggles "Planned", a
 *   double click toggles "Done".
 * - Background: default → Planned (planned only) → Done (done, with or without planned). Changed
 *   by a click, the new colour spreads from where the line was pressed.
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
    '[class.line--repeatable]': '!!line().repeatable',
    '[class.line--clickable]': '!locked()',
    '(click)': 'onLineClick($event)',
    '(dblclick)': 'onLineDoubleClick($event)',
    '(mousedown)': 'keepWordsUnselected($event)',
    '(pointerdown)': 'rememberPress($event)',
    '(animationend)': 'endReveal($event)',
  },
})
export class TaskLine implements OnInit {
  readonly line = input.required<TemplateLine>();
  readonly state = input.required<LineState>();
  readonly stateChange = output<Partial<LineState>>();
  /** "Other" lines: show the delete button */
  readonly removable = input(false);
  /** Invoiced worksheet: the line is read-only */
  readonly locked = input(false);
  /** Section counted in litres (fluids): quantity field, taken by the invoice */
  readonly quantity = input(false);
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

  /**
   * "Other" lines: clearing the text keeps the line (and the focus), like the note field;
   * the line is removed once the field loses focus while still empty.
   */
  protected removeIfEmpty(): void {
    if (this.canHaveNote() || !this.removable()) return;
    if (!hasLineValues(this.state())) this.remove.emit();
  }

  protected togglePlanned(): void {
    this.stateChange.emit({ planned: !this.state().planned });
  }

  protected toggleDone(): void {
    this.stateChange.emit({ done: !this.state().done });
  }

  /** "Planned" toggled by the first click of the line, unless a second click follows */
  private pendingPlanned: ReturnType<typeof setTimeout> | undefined;
  /** "Planned" before the first click, to restore it if that click turns out to start a double click */
  private plannedBeforeClick: boolean | null = null;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Colour of the line */
  private readonly tone = computed(() => (this.state().done ? 'done' : this.state().planned ? 'planned' : 'none'));
  /** Last press on the line: where (in the line) and when, with the size of the line then */
  private lastPress: { x: number; y: number; width: number; height: number; at: number } | null = null;
  /** The two classes of the spreading colour alternate, so a new change restarts it */
  private revealClass: 'line--reveal-a' | 'line--reveal-b' = 'line--reveal-b';

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.pendingPlanned));
    let previousTone: string | undefined;
    effect(() => {
      const tone = this.tone();
      const changed = previousTone !== undefined && tone !== previousTone;
      previousTone = tone;
      if (changed) untracked(() => this.revealFromPress());
    });
  }

  /** Where the line is pressed (on the line, a checkbox, an option…): the new colour starts there */
  protected rememberPress(event: PointerEvent): void {
    const rect = this.host.getBoundingClientRect();
    this.lastPress = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      at: Date.now(),
    };
  }

  /**
   * The colour just changed: if the line was pressed a moment ago, a circle of the new colour grows
   * from there until it covers the line (the background itself changes at the end, see the styles)
   */
  private revealFromPress(): void {
    const press = this.lastPress;
    this.lastPress = null;
    if (!press || Date.now() - press.at > REVEAL_WINDOW) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Distance to the farthest corner: the circle then covers the whole line
    const radius = Math.hypot(Math.max(press.x, press.width - press.x), Math.max(press.y, press.height - press.y));
    this.host.style.setProperty('--reveal-x', `${press.x}px`);
    this.host.style.setProperty('--reveal-y', `${press.y}px`);
    this.host.style.setProperty('--reveal-r', `${Math.ceil(radius)}px`);
    this.host.classList.remove(this.revealClass);
    this.revealClass = this.revealClass === 'line--reveal-a' ? 'line--reveal-b' : 'line--reveal-a';
    this.host.classList.add(this.revealClass);
  }

  /** The circle covers the line, whose background now has the new colour */
  protected endReveal(event: AnimationEvent): void {
    if (event.target !== this.host || event.pseudoElement !== '::before') return;
    this.host.classList.remove('line--reveal-a', 'line--reveal-b');
  }

  /** One click on the line itself: "Planned" (after a short wait, in case it is a double click) */
  protected onLineClick(event: MouseEvent): void {
    if (this.locked() || this.onControl(event) || event.detail !== 1) return;
    this.plannedBeforeClick = this.state().planned;
    clearTimeout(this.pendingPlanned);
    this.pendingPlanned = setTimeout(() => {
      this.pendingPlanned = undefined;
      this.togglePlanned();
    }, DOUBLE_CLICK_DELAY);
  }

  /** Double click on the line itself: "Done" only (the first click does not toggle "Planned") */
  protected onLineDoubleClick(event: MouseEvent): void {
    if (this.locked() || this.onControl(event)) return;
    const changes: Partial<LineState> = { done: !this.state().done };
    if (this.pendingPlanned !== undefined) {
      clearTimeout(this.pendingPlanned);
      this.pendingPlanned = undefined;
    } else if (this.plannedBeforeClick !== null && this.state().planned !== this.plannedBeforeClick) {
      // A slow double click: its first click already toggled "Planned", put it back
      changes.planned = this.plannedBeforeClick;
    }
    this.plannedBeforeClick = null;
    this.stateChange.emit(changes);
  }

  /** A double click on the line does not select its words */
  protected keepWordsUnselected(event: MouseEvent): void {
    if (!this.locked() && event.detail > 1 && !this.onControl(event)) event.preventDefault();
  }

  private onControl(event: Event): boolean {
    return !!(event.target as Element | null)?.closest(CONTROLS);
  }

  protected updateNote(note: string): void {
    this.stateChange.emit(this.planIfFirstText({ note }, this.state().note, note));
  }

  protected updateQuantity(quantity: string): void {
    this.stateChange.emit(this.planIfFirstText({ quantity }, this.state().quantity ?? null, quantity));
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
    // Filling a field (text, number, date, radio, checkbox) marks the line as planned
    this.stateChange.emit(this.planIfFirstText(changes, this.value(field), value));
  }

  /**
   * Filling an empty note, field or quantity (first character, first option chosen) marks the
   * line as planned; it can be unchecked afterwards and is not checked again while the field stays
   * filled.
   */
  private planIfFirstText(changes: Partial<LineState>, before: LineFieldValue, after: LineFieldValue): Partial<LineState> {
    const filled = (value: LineFieldValue) =>
      Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim() !== '';
    return !this.state().planned && !filled(before) && filled(after) ? { ...changes, planned: true } : changes;
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
