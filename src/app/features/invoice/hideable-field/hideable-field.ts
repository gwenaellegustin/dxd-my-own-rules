import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../../shared/icon/icon';

/**
 * Wraps a text field of an open invoice (observations, note of an item) and adds two small
 * buttons inside it, on the right:
 * - Hide / Show: a hidden text stays shown, dimmed (and editable), but is not printed nor in the
 *   PDF (the parent puts its printed copy aside);
 * - Delete: the parent empties or removes the text.
 * Both are left out while the field is empty (`empty`).
 *
 * Usage: <app-hideable-field [hidden]="…" (hiddenChange)="…" (remove)="…"><textarea class="textarea" …></textarea></app-hideable-field>
 */
@Component({
  selector: 'app-hideable-field',
  imports: [TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content />
    <!-- Empty field: nothing to hide or delete -->
    @if (!empty()) {
      <span class="hideable-field__buttons">
        @let hideKey = hidden() ? 'invoice.fieldShow' : 'invoice.fieldHide';
        <button
          type="button"
          class="hideable-field__button"
          [attr.aria-pressed]="hidden()"
          [attr.aria-label]="hideKey | translate"
          [attr.title]="hideKey | translate"
          (click)="hiddenChange.emit(!hidden())"
        >
          <app-icon [name]="hidden() ? 'show' : 'hide'" size="small" />
        </button>
        <button
          type="button"
          class="hideable-field__button"
          [attr.aria-label]="'invoice.fieldDelete' | translate"
          [attr.title]="'invoice.fieldDelete' | translate"
          (click)="remove.emit()"
        >
          <app-icon name="close" size="small" />
        </button>
      </span>
    }
  `,
  host: {
    class: 'hideable-field',
    '[class.hideable-field--hidden]': 'hidden()',
  },
  styles: `
    :host {
      position: relative;
      display: grid;
      min-width: 0;
    }

    // On the first row of the field, like the cross of <app-clearable>
    .hideable-field__buttons {
      position: absolute;
      top: calc(var(--control-height) / 2);
      right: var(--space-200);
      transform: translateY(-50%);
      display: flex;
      gap: var(--space-100);
    }

    .hideable-field__button {
      display: grid;
      place-content: center;
      width: var(--field-button-size);
      height: var(--field-button-size);
      border-radius: var(--radius-200);
      color: var(--color-on-background-soft);

      &:hover {
        background: var(--color-neutral);
        color: var(--color-on-background);
      }
    }
  `,
})
export class HideableField {
  readonly hidden = input(false);
  /** The field holds no text: no buttons */
  readonly empty = input(false);
  readonly hiddenChange = output<boolean>();
  readonly remove = output<void>();
}
