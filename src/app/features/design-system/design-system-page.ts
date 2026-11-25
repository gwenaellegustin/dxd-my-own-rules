import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DesignToken,
  DesignTokensService,
  TOKEN_GROUPS,
} from '../../core/services/design-tokens.service';
import { ICON_NAMES, Icon, IconName } from '../../shared/icon/icon';
import { VehicleLogo } from '../../shared/vehicle-logo/vehicle-logo';

/** Below this width the token panel overlays the page (see _breakpoints.scss) */
const DESKTOP_QUERY = '(min-width: 1200px)';

const STATUS_FAMILIES = ['info', 'success', 'error'] as const;

const TEXT_STYLES = [
  {
    key: 'heading',
    cls: 'text-heading',
    size: '--font-size-heading',
    lineHeight: '--line-height-heading',
  },
  {
    key: 'subheading',
    cls: 'text-subheading',
    size: '--font-size-subheading',
    lineHeight: '--line-height-heading',
  },
  { key: 'body', cls: '', size: '--font-size-medium', lineHeight: '--line-height-body' },
  { key: 'small', cls: 'text-small', size: '--font-size-small', lineHeight: '--line-height-body' },
];

/** Icons of the design system page, by role (in the order of the page) */
const ICON_GROUPS: { id: string; icons: IconName[] }[] = [
  {
    id: 'navigation',
    icons: [
      'back',
      'forward',
      'chevron-down',
      'chevron-right',
      'menu',
      'left-panel-close',
      'right-panel-close',
    ],
  },
  {
    id: 'actions',
    icons: [
      'plus-circle',
      'edit',
      'delete',
      'close',
      'undo',
      'redo',
      'search',
      'sort',
      'send',
      'pdf',
      'upload',
      'archive',
      'unarchive',
      'hide',
      'show',
      'mark-read',
      'check',
      'drag',
      'damage-bump',
      'damage-impact',
      'damage-scratch',
    ],
  },
  {
    id: 'objects',
    icons: [
      'tool',
      'invoice',
      'person',
      'cart',
      'transcript',
      'registration',
      'note',
      'calendar',
      'settings',
      'language',
      'car',
      'motorcycle',
      'lift',
    ],
  },
];

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Design system (only reachable by its URL, /design-system): every token and the shared
 * components, with a side panel to change the token values. A change applies to the whole app
 * at once and is kept in this browser; "Copy the changes" gives the lines for _tokens.scss.
 */
@Component({
  selector: 'app-design-system-page',
  imports: [NgTemplateOutlet, TranslatePipe, Icon, VehicleLogo],
  templateUrl: './design-system-page.html',
  styleUrl: './design-system-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemPage {
  protected readonly ds = inject(DesignTokensService);

  private readonly tokens = this.ds.tokens;
  /** Icons by role; an icon not classified yet is shown in "Others" */
  protected readonly iconGroups = [
    ...ICON_GROUPS,
    { id: 'other', icons: ICON_NAMES.filter((n) => !ICON_GROUPS.some((g) => g.icons.includes(n))) },
  ].filter((group) => group.icons.length > 0);

  /** Buttons shown in each state (`is-hover` gives the hover look without the pointer) */
  protected readonly buttonStates = ['normal', 'hover', 'disabled'] as const;
  protected readonly buttonVariants: { key: string; cls: string; icon?: IconName }[] = [
    { key: 'primary', cls: 'button button--primary' },
    { key: 'secondary', cls: 'button' },
    { key: 'danger', cls: 'button button--danger' },
    { key: 'subtle', cls: 'button-subtle' },
    { key: 'icon', cls: 'icon-button', icon: 'settings' },
    { key: 'iconPrimary', cls: 'icon-button icon-button--primary', icon: 'check' },
  ];
  protected readonly menuStates = ['normal', 'hover', 'selected'] as const;
  protected readonly vehicleStates = ['shown', 'hidden', 'hover'] as const;
  protected readonly rowStates = ['normal', 'hover'] as const;

  /** Colors: one family per status (text, background, border) */
  protected readonly statusFamilies = STATUS_FAMILIES.map((id) => ({
    id,
    tokens: this.tokens.filter((t) => t.name.startsWith(`--color-${id}`)),
  }));
  /** Text / icon colours, shown on the background and on a surface */
  protected readonly inks = this.tokens.filter((t) => t.name.startsWith('--color-on-background'));

  protected readonly fonts = this.tokens.filter((t) => /^--font-(body|heading)$/.test(t.name));
  /** Text styles of the app: sample class and the tokens it is made of */
  protected readonly textStyles = TEXT_STYLES;
  protected readonly spaces = this.byGroup('spacing');
  protected readonly radii = this.byGroup('radius');
  /** Strokes, opacity, shadows, backdrop, motion: each kind has its own sample */
  protected readonly effects = this.byGroup('effects').map((token) => ({
    token,
    kind: token.name.split('-')[2] as 'stroke' | 'opacity' | 'shadow' | 'overlay',
  }));

  protected readonly panelOpen = signal(matchMedia(DESKTOP_QUERY).matches);

  /** Panel: tokens whose name contains the filter, by group */
  protected readonly filter = signal('');
  protected readonly panelGroups = computed(() => {
    const query = this.filter().trim().toLowerCase();
    return TOKEN_GROUPS.map((id) => ({
      id,
      tokens: this.tokens.filter((t) => t.group === id && t.name.includes(query)),
    })).filter((group) => group.tokens.length > 0);
  });

  protected readonly copied = signal(false);

  protected isColor(token: DesignToken): boolean {
    return HEX_COLOR.test(this.ds.value(token));
  }

  /** <input type="color"> only takes #rrggbb */
  protected colorPickerValue(token: DesignToken): string {
    const hex = this.ds.value(token).slice(1);
    const rgb = hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join('') : hex.slice(0, 6);
    return '#' + rgb.toLowerCase();
  }

  protected copyChanges(): void {
    navigator.clipboard?.writeText(this.ds.changesAsCss()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  /** Translation key of "when is this token used" (designSystem.usage, by name without "--") */
  protected usageKey(name: string): string {
    return 'designSystem.usage.' + name.slice(2);
  }

  /**
   * A mixed colour, readable: `color-mix(in srgb, var(--color-info) 12%, var(--color-surface))`
   * gives "12% --color-info + 88% --color-surface" (any other value is returned as is)
   */
  protected mixFormula(token: DesignToken): string {
    const value = this.ds.value(token);
    const mix =
      /color-mix\(in \w+,\s*var\(--color-([\w-]+)\)\s+([\d.]+)%,\s*var\(--color-([\w-]+)\)\)/.exec(
        value,
      );
    if (!mix) return value;
    const [, first, percent, second] = mix;
    return `${percent}% --color-${first} + ${100 - Number(percent)}% --color-${second}`;
  }

  /** Current value of a token, by name */
  protected valueOf(name: string): string {
    const token = this.tokens.find((t) => t.name === name);
    return token ? this.ds.value(token) : '';
  }

  private byGroup(group: DesignToken['group']): DesignToken[] {
    return this.tokens.filter((t) => t.group === group);
  }
}
