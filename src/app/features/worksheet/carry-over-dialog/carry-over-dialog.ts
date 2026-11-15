import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

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

/**
 * Shown before creating the invoice: lists the lines planned but not done.
 * Everything is checked by default; checked items are carried over to the next intervention.
 */
@Component({
  selector: 'app-carry-over-dialog',
  imports: [TranslatePipe],
  templateUrl: './carry-over-dialog.html',
  styleUrl: './carry-over-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarryOverDialog {
  readonly groups = input.required<CarryOverGroup[]>();
  readonly confirmed = output<string[]>();
  readonly cancelled = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Keys of the checked items: all of them when the dialog opens */
  protected readonly selected = linkedSignal(
    () => new Set(this.groups().flatMap((group) => group.items.map((item) => item.key))),
  );
  protected readonly selectedCount = computed(() => this.selected().size);

  constructor() {
    // Native modal: focus trap, Escape and backdrop come with it
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected toggle(key: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected confirm(): void {
    this.confirmed.emit([...this.selected()]);
  }

  /** Click on the backdrop (outside the dialog box) closes it */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.cancelled.emit();
  }
}
