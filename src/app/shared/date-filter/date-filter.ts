import { ChangeDetectionStrategy, Component, ElementRef, input, model, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../icon/icon';

/**
 * Calendar button that picks one day (yyyy-MM-dd) with the browser's date picker: a hidden date
 * input lies under the button. Dark while a day is chosen; `value` null = no filter.
 */
@Component({
  selector: 'app-date-filter',
  imports: [TranslatePipe, Icon],
  template: `
    <button
      type="button"
      class="icon-button"
      [class.active]="value()"
      [attr.aria-label]="labelKey() | translate"
      [attr.title]="labelKey() | translate"
      (click)="open()"
    >
      <app-icon name="calendar" />
    </button>
    <input
      #picker
      type="date"
      tabindex="-1"
      aria-hidden="true"
      [max]="max()"
      [value]="value() ?? ''"
      (change)="value.set($any($event.target).value || null)"
    />
  `,
  styles: `
    :host {
      position: relative;
      flex: none;
      display: inline-flex;
    }

    input {
      position: absolute;
      inset: 0;
      opacity: 0;
      pointer-events: none;
    }

    .active,
    .active:hover {
      background: var(--color-on-background);
      color: var(--color-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateFilter {
  readonly value = model<string | null>(null);
  /** Latest day that can be chosen (yyyy-MM-dd) */
  readonly max = input<string>('');
  readonly labelKey = input.required<string>();

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected open(): void {
    const input = this.picker().nativeElement;
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  }
}
