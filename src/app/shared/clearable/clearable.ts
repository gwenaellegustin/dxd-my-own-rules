import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  contentChild,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../icon/icon';

/**
 * Wraps a text <input> or <textarea> and adds a cross button that empties it.
 * Clearing dispatches a native `input` event, so the field's own (input)
 * handler (store update, auto-grow…) runs exactly as if the user typed.
 *
 * Usage: <app-clearable><input class="input" #clearTarget ... /></app-clearable>
 */
@Component({
  selector: 'app-clearable',
  imports: [TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
    @if (hasValue()) {
      <button
        type="button"
        class="clearable__button"
        [attr.aria-label]="'common.clear' | translate"
        [attr.title]="'common.clear' | translate"
        (click)="clear()"
      >
        <app-icon name="close" size="small" />
      </button>
    }
  `,
  host: {
    class: 'clearable',
    '(input)': 'refresh()',
  },
  styles: `
    :host {
      position: relative;
      display: inline-grid;
      min-width: 0;
    }

    .clearable__button {
      position: absolute;
      top: calc(var(--control-height) / 2);
      right: var(--space-200);
      transform: translateY(-50%);
      display: grid;
      place-content: center;
      width: var(--icon-size-large);
      height: var(--icon-size-large);
      border-radius: var(--radius-full);
      color: var(--color-text-secondary);

      &:hover {
        background: var(--color-background-hover);
        color: var(--color-text-default);
      }
    }
  `,
})
export class Clearable implements AfterContentInit {
  private readonly field = contentChild.required<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('clearTarget');

  protected readonly hasValue = signal(false);

  ngAfterContentInit(): void {
    // [value] bindings are applied after content init: read once they are set
    queueMicrotask(() => this.refresh());
  }

  protected refresh(): void {
    this.hasValue.set(this.field().nativeElement.value !== '');
  }

  protected clear(): void {
    const el = this.field().nativeElement;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
}
