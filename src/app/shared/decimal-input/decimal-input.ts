import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Shows a number with a fixed count of decimals in an <input> (prices: 100 → "100.00").
 * Replaces the [value] binding: the field is rewritten when it loses focus, and when the value
 * changes from outside (undo / redo…), not when it follows what the user types (the caret would
 * jump; an emptied field counts as 0).
 *
 * <input type="number" [appDecimal]="item.price" (input)="…" />
 */
@Directive({
  selector: 'input[appDecimal]',
  host: { '(blur)': 'format()' },
})
export class DecimalInput {
  readonly appDecimal = input.required<number>();
  readonly decimals = input(2);

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      const value = this.appDecimal();
      const decimals = this.decimals();
      const typed = this.element.valueAsNumber;
      if (document.activeElement === this.element && (Number.isNaN(typed) ? 0 : typed) === value) return;
      this.element.value = value.toFixed(decimals);
    });
  }

  protected format(): void {
    this.element.value = this.appDecimal().toFixed(this.decimals());
  }
}
