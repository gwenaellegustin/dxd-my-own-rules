import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, model, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon, IconName } from '../icon/icon';
import { Clearable } from '../clearable/clearable';
import { VehicleLogo } from '../vehicle-logo/vehicle-logo';
import { Dropdown } from '../dropdown/dropdown';
import { PanelResize } from '../panel-resize/panel-resize';
import { PanelWidthService } from '../../core/services/panel-width.service';

/** One card of the list: a vehicle and its client (a worksheet, an invoice…) */
export interface VehicleCard {
  id: string;
  vehicle: string;
  client: string;
  /** ISO date (yyyy-MM-dd) shown under the title, if any */
  date: string | null;
  /** Without a brand logo: show the vehicle on the lift (work in progress) instead of a car */
  lifted?: boolean;
  /** Cards that are not a vehicle (e.g. a client): own title, second line and icon */
  title?: string;
  subtitle?: string;
  icon?: IconName;
  /** Counts shown on the right of the card (e.g. open worksheets, open / sent invoices) */
  badges?: CardBadge[];
  /** Finished (invoiced worksheet, paid invoice): grey card */
  done?: boolean;
  /** Status chip under the text, e.g. an invoice past its payment term: `status-chip--{status}` */
  chip?: { status: string; labelKey: string };
}

export interface CardBadge {
  count: number;
  icon: IconName;
  /** Colours of the invoice status chips: open = blue, alert = red (sent, not paid yet) */
  tone: 'neutral' | 'open' | 'alert';
  /** Accessible text, with {{count}} */
  labelKey: string;
}

export interface SortOption {
  id: string;
  labelKey: string;
}

export interface VehicleCardGroup {
  id: string;
  /** Translation key of the group heading; the first group (open items) has none in the design */
  titleKey: string | null;
  cards: VehicleCard[];
  /** Done items (invoiced worksheets, paid invoices): a chevron opens the group, closed at first */
  collapsible?: boolean;
}

/**
 * Left side panel listing vehicle cards by group, with a search ("Left sidebar" component set
 * of the Figma file: Default / selected card / Closed). Used for worksheets and invoices.
 */
@Component({
  selector: 'app-vehicle-sidebar',
  imports: [DatePipe, TranslatePipe, Icon, Clearable, VehicleLogo, Dropdown, PanelResize],
  templateUrl: './vehicle-sidebar.html',
  styleUrl: './vehicle-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // is-opening: read here, the binding runs also while the panel is closed (see opening)
  host: { '[class.is-open]': 'open()', '[class.is-opening]': 'opening()' },
})
export class VehicleSidebar {
  readonly titleKey = input.required<string>();
  /** Icon of the panel button (open and collapsed) */
  readonly icon = input.required<IconName>();
  readonly groups = input.required<VehicleCardGroup[]>();
  readonly selectedId = input<string | null>(null);
  readonly open = input(true);
  /** Opened by the user (not when a page shows it already open): the panel slides in */
  protected readonly opening = linkedSignal<boolean, boolean>({
    source: this.open,
    computation: (open, previous) => open && !!previous && !previous.source,
  });
  /** Label of the "New…" button; no button when null */
  readonly newLabelKey = input<string | null>(null);
  readonly emptyKey = input.required<string>();
  /** Shown on a card without vehicle nor client */
  readonly untitledKey = input<string>('worksheets.untitled');

  /** Ways to order the cards: a button next to the search opens them (none: no button) */
  readonly sortOptions = input<SortOption[]>([]);
  readonly sort = model<string | null>(null);

  readonly selectCard = output<string>();
  readonly create = output<void>();
  readonly openChange = output<boolean>();

  protected readonly query = signal('');
  /** Width chosen by dragging the right edge, kept from one page to the other */
  protected readonly widths = inject(PanelWidthService);

  /** Collapsible groups opened (true) or closed (false) by their chevron, by group id */
  private readonly toggled = signal<Record<string, boolean>>({});

  /**
   * Groups filtered by the search; empty groups are hidden. A collapsible group is closed at
   * first, but open while searching or when it holds the card shown, so neither is ever hidden;
   * its chevron decides once used.
   */
  protected readonly visibleGroups = computed(() => {
    const query = this.query().trim().toLowerCase();
    const toggled = this.toggled();
    return this.groups()
      .map((group) => {
        const cards = group.cards.filter((card) => !query || searchText(card).includes(query));
        const holdsSelected = cards.some((card) => card.id === this.selectedId());
        const expanded = !group.collapsible || (toggled[group.id] ?? (!!query || holdsSelected));
        return { ...group, cards, expanded };
      })
      .filter((group) => group.cards.length > 0);
  });

  protected toggleGroup(id: string, expanded: boolean): void {
    this.toggled.update((toggled) => ({ ...toggled, [id]: !expanded }));
  }
}

/** What the search looks in: vehicle, client, title and second line */
const searchText = (card: VehicleCard): string =>
  [card.vehicle, card.client, card.title, card.subtitle].filter(Boolean).join(' ').toLowerCase();
