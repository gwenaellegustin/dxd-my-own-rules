import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Empty page used by sections that are not designed yet. */
@Component({
  selector: 'app-placeholder-page',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-heading">{{ titleKey() | translate }}</h1>
    <p class="text-secondary">{{ 'common.notDesignedYet' | translate }}</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-200);
      padding: var(--space-400);
    }
  `,
})
export class PlaceholderPage {
  readonly titleKey = input.required<string>();
}
