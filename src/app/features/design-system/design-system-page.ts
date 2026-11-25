import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { DesignToken, DesignTokensService } from '../../core/services/design-tokens.service';
import { ICON_NAMES, Icon, IconName, IconSize } from '../../shared/icon/icon';
import { VehicleLogo } from '../../shared/vehicle-logo/vehicle-logo';
import { isDesktop } from '../../core/utils/breakpoints';
import { TokenPanel } from './token-panel/token-panel';
import { Combobox } from '../../shared/combobox/combobox';
import { Clearable } from '../../shared/clearable/clearable';
import { DateFilter } from '../../shared/date-filter/date-filter';
import { HideableField } from '../invoice/hideable-field/hideable-field';
import { TranscriptChangeCard } from '../../layout/transcript-change/transcript-change';
import { TranscriptChange } from '../../core/models/transcript.model';
import { WorksheetStore } from '../../core/services/worksheet.store';
import { WorksheetSettingsStore } from '../../core/services/worksheet-settings.store';

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


/**
 * Design system (only reachable by its URL, /design-system): every token and the shared
 * components, with a side panel to change the token values. A change applies to the whole app
 * at once and is kept in this browser; "Copy the changes" gives the lines for _tokens.scss.
 */
@Component({
  selector: 'app-design-system-page',
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    Icon,
    VehicleLogo,
    TokenPanel,
    Combobox,
    Clearable,
    DateFilter,
    HideableField,
    TranscriptChangeCard,
  ],
  templateUrl: './design-system-page.html',
  styleUrl: './design-system-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemPage {
  protected readonly ds = inject(DesignTokensService);
  // Real data for the transcript changes (a worksheet and one of its lines)
  private readonly worksheets = inject(WorksheetStore);
  private readonly settings = inject(WorksheetSettingsStore);

  private readonly tokens = this.ds.tokens;
  /** Icons by role; an icon not classified yet is shown in "Others" */
  protected readonly iconGroups = [
    ...ICON_GROUPS,
    { id: 'other', icons: ICON_NAMES.filter((n) => !ICON_GROUPS.some((g) => g.icons.includes(n))) },
  ].filter((group) => group.icons.length > 0);

  /**
   * Buttons shown in each state (`is-hover` gives the hover look without the pointer).
   * `key`: text of the button (and name of the row, unless `row` is set); `lead`: small icon
   * before the text; `withIcon`: same button as the row above, shown with its icon ("+ icon"
   * row); `icon`: button with only an icon, at the size of the icon rule (medium, large in a
   * main icon button).
   */
  protected readonly buttonStates = ['normal', 'hover', 'disabled'] as const;
  protected readonly buttonVariants: {
    key: string;
    row?: string;
    cls: string;
    lead?: IconName;
    withIcon?: boolean;
    icon?: IconName;
    iconSize?: IconSize;
  }[] = [
    { key: 'primary', cls: 'button button--primary' },
    { key: 'primary', cls: 'button button--primary', lead: 'send', withIcon: true },
    { key: 'secondary', cls: 'button' },
    { key: 'secondary', cls: 'button', lead: 'pdf', withIcon: true },
    // Red only to confirm a deletion (the delete buttons of the pages are secondary)
    { key: 'danger', row: 'deleteConfirm', cls: 'button button--danger' },
    // Always with an icon in the app (add a line, a rule, a vehicle…)
    { key: 'subtle', cls: 'button-subtle', lead: 'plus-circle' },
    { key: 'icon', cls: 'icon-button', icon: 'settings', iconSize: 'medium' },
    { key: 'iconPrimary', cls: 'icon-button icon-button--primary', icon: 'check', iconSize: 'large' },
  ];
  protected readonly menuStates = ['normal', 'hover', 'selected'] as const;
  protected readonly vehicleStates = ['shown', 'hidden', 'hover'] as const;
  protected readonly rowStates = ['normal', 'hover'] as const;
  protected readonly sideCardStates = ['normal', 'hover', 'selected', 'cardDone'] as const;
  protected readonly iconSizes = ['small', 'medium', 'large', 'xlarge'] as const;

  /** Samples of the controls: they work, but change nothing in the app */
  protected readonly segmentedValue = signal<'car' | 'motorcycle'>('car');
  protected readonly tabValue = signal(1);
  protected readonly comboValue = signal('');
  protected readonly comboOptions = ['Fabrice Favre', 'Matthieu Berclaz', 'Patrice Petit'];
  protected readonly dateValue = signal<string | null>(null);
  protected readonly noteHidden = signal(false);
  protected readonly noteText = signal('Sans les bougies');

  /** Two changes of an answer, on the first worksheet: a value, and a line planned → done */
  protected readonly changeSamples = computed<TranscriptChange[]>(() => {
    const worksheet = this.worksheets.worksheets()[0];
    const lineKey = this.settings.allSections()[0]?.lines.find((line) => line.titleKey)?.titleKey;
    if (!worksheet || !lineKey) return [];
    const target = { type: 'worksheet' as const, id: worksheet.id };
    return [
      { target, area: '', labelKey: 'worksheet.kilometers', before: "61'000", after: "61'240" },
      { target, area: '', labelKey: lineKey, before: '', after: '', statusBefore: 'planned', statusAfter: 'done' },
    ];
  });

  constructor() {
    this.worksheets.load();
    this.settings.load();
  }

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

  /** Token panel: open on desktop, collapsed to its rail on smaller screens */
  protected readonly panelOpen = signal(isDesktop());

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
