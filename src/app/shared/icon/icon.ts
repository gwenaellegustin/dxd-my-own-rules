import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type IconName =
  | 'bill'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'close'
  | 'damage-impact'
  | 'damage-scratch'
  | 'edit'
  | 'invoice'
  | 'left-panel-close'
  | 'lift'
  | 'plus-circle'
  | 'right-panel-close'
  | 'search'
  | 'tool'
  | 'transcript';

export type IconSize = 'small' | 'medium' | 'large' | 'xlarge';

/**
 * Renders an SVG from `public/icons` as a CSS mask so it takes the
 * current text color: icons follow the color tokens automatically.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    'aria-hidden': 'true',
    '[style.--icon-url]': 'url()',
    '[style.--icon-size]': 'sizeVar()',
  },
  styles: `
    :host {
      display: inline-block;
      flex: none;
      width: var(--icon-size);
      height: var(--icon-size);
      background-color: currentColor;
      mask: var(--icon-url) center / contain no-repeat;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('medium');

  protected readonly url = computed(() => `url('/icons/${this.name()}.svg')`);
  protected readonly sizeVar = computed(() => `var(--icon-size-${this.size()})`);
}
