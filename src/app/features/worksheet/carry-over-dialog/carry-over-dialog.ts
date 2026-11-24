import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalDialog } from '../../../shared/modal-dialog/modal-dialog';

export interface CarryOverItem {
  /** Line state key (e.g. "oilFilter" or "partsOther~2") */
  key: string;
  /** Translated line title, or the free text of an "Other" line */
  titleKey?: string;
  text?: string;
}

export interface CarryOverGroup {
  sectionTitleKey: string;
  items: CarryOverItem[];
}

export interface CarryOverResult {
  /** Lines to carry over to the next intervention */
  carryOver: string[];
  /** Lines marked done from the dialog */
  done: string[];
}

/**
 * Shown before creating the invoice: lists the lines planned but not done.
 * - Everything is checked by default; checked items are carried over to the next intervention.
 * - "Done" marks the line as done instead (it is then not carried over).
 * - Next to each section title, one link unchecks (or checks again) all its items.
 */
@Component({
  selector: 'app-carry-over-dialog',
  imports: [TranslatePipe, ModalDialog],
  templateUrl: './carry-over-dialog.html',
  styleUrl: './carry-over-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarryOverDialog {
  readonly groups = input.required<CarryOverGroup[]>();
  readonly confirmed = output<CarryOverResult>();
  readonly cancelled = output<void>();

  /** Keys of the items to carry over: all of them when the dialog opens */
  protected readonly selected = linkedSignal(
    () => new Set(this.groups().flatMap((group) => group.items.map((item) => item.key))),
  );
  /** Keys of the items marked done */
  protected readonly done = signal(new Set<string>());

  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly doneCount = computed(() => this.done().size);

  protected toggle(key: string): void {
    this.selected.update((current) => toggled(current, key));
  }

  /** A done item is not carried over; unmarking it carries it over again (the default) */
  protected toggleDone(key: string): void {
    const isDone = this.done().has(key);
    this.done.update((current) => toggled(current, key));
    this.selected.update((current) => {
      const next = new Set(current);
      if (isDone) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  /** Items of the group that can be carried over (not done) */
  private openKeys(group: CarryOverGroup): string[] {
    return group.items.map((item) => item.key).filter((key) => !this.done().has(key));
  }

  /** True when at least one item of the group is checked: the button then unchecks them all */
  protected anyChecked(group: CarryOverGroup): boolean {
    return this.openKeys(group).some((key) => this.selected().has(key));
  }

  protected toggleGroup(group: CarryOverGroup): void {
    const check = !this.anyChecked(group);
    this.selected.update((current) => {
      const next = new Set(current);
      for (const key of this.openKeys(group)) {
        if (check) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  protected confirm(): void {
    this.confirmed.emit({ carryOver: [...this.selected()], done: [...this.done()] });
  }
}

function toggled(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}
