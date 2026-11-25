import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterEveryRender,
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
      width: var(--field-button-size);
      height: var(--field-button-size);
      border-radius: var(--radius-200);
      color: var(--color-on-background-soft);

      &:hover {
        background: var(--color-line);
        color: var(--color-on-background);
      }
    }
  `,
})
export class Clearable implements AfterContentInit {
  private readonly field = contentChild.required<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('clearTarget');

  protected readonly hasValue = signal(false);

  constructor() {
    // The value can also change without an input event (undo, another worksheet selected):
    // re-read it after each render (writing the same boolean again changes nothing)
    afterEveryRender({ read: () => this.refresh() });
  }

  ngAfterContentInit(): void {
    // [value] bindings are applied after content init: read once they are set
    queueMicrotask(() => this.refresh());
  }

  protected refresh(): void {
    // No ✕ on a field that cannot be edited
    const field = this.field().nativeElement;
    this.hasValue.set(field.value !== '' && !field.disabled && !field.readOnly);
  }

  protected clear(): void {
    const el = this.field().nativeElement;
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
}
