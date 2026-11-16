import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Shows a number with a fixed count of decimals in an <input> (prices: 100 → "100.00").
 * Replaces the [value] binding: the field is rewritten when the value changes from outside, and
 * when it loses focus, never while the user types in it (the caret would jump).
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
      if (document.activeElement !== this.element) this.element.value = value.toFixed(decimals);
    });
  }

  protected format(): void {
    this.element.value = this.appDecimal().toFixed(this.decimals());
  }
}
