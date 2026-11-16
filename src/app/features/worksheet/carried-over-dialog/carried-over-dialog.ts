import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalDialog } from '../../../shared/modal-dialog/modal-dialog';
import { Icon } from '../../../shared/icon/icon';
import { CarryOverGroup } from '../carry-over-dialog/carry-over-dialog';

/** Items of one section carried over by one previous intervention (`date`) */
export interface CarriedOverGroup extends CarryOverGroup {
  date: string | null;
}

export interface CarriedOverResult {
  /** Items to add to the worksheet */
  imported: string[];
  /** Items no longer carried over (not proposed again) */
  deleted: string[];
}

/**
 * Shown on an open worksheet when previous interventions on the vehicle carried lines over
 * (see CarryOverDialog). Each item is:
 * - checked (the default): imported into the worksheet;
 * - unchecked: not imported, still proposed for the next worksheet;
 * - deleted: no longer carried over.
 */
@Component({
  selector: 'app-carried-over-dialog',
  imports: [TranslatePipe, DatePipe, ModalDialog, Icon],
  templateUrl: './carried-over-dialog.html',
  styleUrl: './carried-over-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarriedOverDialog {
  readonly groups = input.required<CarriedOverGroup[]>();
  readonly confirmed = output<CarriedOverResult>();
  readonly cancelled = output<void>();

  protected readonly selected = linkedSignal(
    () => new Set(this.groups().flatMap((group) => group.items.map((item) => item.key))),
  );
  protected readonly deleted = signal(new Set<string>());

  /** Same date for every group: shown in the title, else next to each section */
  protected readonly singleDate = computed(() => {
    const dates = new Set(this.groups().map((group) => group.date));
    return dates.size === 1 ? { date: [...dates][0] } : null;
  });
  protected readonly importedCount = computed(() => this.selected().size);
  protected readonly deletedCount = computed(() => this.deleted().size);

  protected toggle(key: string): void {
    this.selected.update((current) => toggled(current, key));
  }

  /** A deleted item is not imported; restoring it imports it again (the default) */
  protected toggleDeleted(key: string): void {
    const isDeleted = this.deleted().has(key);
    this.deleted.update((current) => toggled(current, key));
    this.selected.update((current) => {
      const next = new Set(current);
      if (isDeleted) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected confirm(): void {
    this.confirmed.emit({ imported: [...this.selected()], deleted: [...this.deleted()] });
  }
}

function toggled(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}
