import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * App icon names → Google Material Symbols (https://fonts.google.com/icons).
 * To add an icon: add it here AND to the `icon_names` list of the font link in index.html.
 */
const MATERIAL_SYMBOLS = {
  calendar: 'calendar_today',
  car: 'directions_car',
  check: 'check',
  'chevron-down': 'keyboard_arrow_down',
  close: 'close',
  delete: 'delete',
  'damage-bump': 'circle',
  'damage-impact': 'close',
  'damage-scratch': 'pen_size_2',
  note: 'maps_ugc',
  registration: 'two_pager',
  invoice: 'receipt_long',
  'left-panel-close': 'left_panel_close',
  lift: 'car_repair',
  'plus-circle': 'add_circle',
  'right-panel-close': 'right_panel_close',
  search: 'search',
  tool: 'build',
  transcript: 'speech_to_text',
  upload: 'add_photo_alternate',
  motorcycle: 'two_wheeler',
} as const;

export type IconName = keyof typeof MATERIAL_SYMBOLS;
export type IconSize = 'small' | 'medium' | 'large' | 'xlarge';

/** Google Material Symbols icon; takes the current text color and the size tokens. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '{{ symbol() }}',
  host: {
    class: 'material-symbols-outlined',
    'aria-hidden': 'true',
    translate: 'no',
    '[style.--icon-size]': 'sizeVar()',
  },
  styles: `
    // Material Symbols keep ~1/6 of empty margin around each glyph: the glyph is
    // drawn 20% bigger so it fills the space like the Figma icons, and the negative
    // margin keeps the space taken in the layout equal to --icon-size (centered).
    :host {
      --glyph-size: calc(var(--icon-size) * 1.2);
      display: inline-block;
      flex: none;
      width: var(--glyph-size);
      height: var(--glyph-size);
      margin: calc((var(--icon-size) - var(--glyph-size)) / 2);
      font-size: var(--glyph-size);
      line-height: 1;
      text-align: center;
      user-select: none;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('medium');

  protected readonly symbol = computed(() => MATERIAL_SYMBOLS[this.name()]);
  protected readonly sizeVar = computed(() => `var(--icon-size-${this.size()})`);
}
