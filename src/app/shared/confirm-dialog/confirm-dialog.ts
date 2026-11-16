import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalDialog } from '../modal-dialog/modal-dialog';

/**
 * Asks to confirm an action (e.g. delete a worksheet). Escape, a click on the backdrop or
 * "Cancel" cancel it; the confirm button is red for a destructive action (`danger`).
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe, ModalDialog],
  template: `
    <dialog class="dialog" aria-labelledby="confirm-title" aria-describedby="confirm-message" appModalDialog (dismiss)="cancelled.emit()">
      <form class="dialog__box" (submit)="$event.preventDefault(); confirmed.emit()">
        <h2 id="confirm-title" class="text-subheading">{{ titleKey() | translate }}</h2>
        <p id="confirm-message" class="dialog__body">{{ messageKey() | translate: params() }}</p>
        <div class="dialog__actions dialog__actions--end">
          <button type="button" class="button" (click)="cancelled.emit()">{{ 'common.cancel' | translate }}</button>
          <button type="submit" class="button" [class.button--danger]="danger()" [class.button--primary]="!danger()">
            {{ confirmKey() | translate }}
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .dialog__actions--end {
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly titleKey = input.required<string>();
  readonly messageKey = input.required<string>();
  readonly params = input<Record<string, string>>({});
  readonly confirmKey = input.required<string>();
  readonly danger = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
