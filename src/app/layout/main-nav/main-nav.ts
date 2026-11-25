import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { Icon, IconName } from '../../shared/icon/icon';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { Dropdown } from '../../shared/dropdown/dropdown';

interface NavItem {
  path: string;
  labelKey: string;
  icon: IconName;
  badge?: () => number;
}

/** Place of the current-page shape in the bar of pills: px from its left and right edges */
interface Place {
  left: number;
  right: number;
}

/**
 * Main navigation of the header: icon + name pills; on mobile a button showing the current page
 * opens a menu with every page.
 *
 * The light shape under the current page is a single element: when the page changes it flows to
 * the new pill, its front edge first and its back edge a little later, so it stretches like a drop.
 */
@Component({
  selector: 'app-main-nav',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, TranslatePipe, Icon, Dropdown],
  templateUrl: './main-nav.html',
  styleUrl: './main-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainNav {
  private readonly router = inject(Router);
  private readonly shoppingList = inject(ShoppingListService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');

  protected readonly items: NavItem[] = [
    { path: '/worksheets', labelKey: 'nav.worksheet', icon: 'tool' },
    { path: '/invoices', labelKey: 'nav.invoice', icon: 'invoice' },
    { path: '/clients', labelKey: 'nav.clients', icon: 'person' },
    { path: '/shopping-list', labelKey: 'nav.shoppingList', icon: 'cart', badge: () => this.shoppingList.count() },
  ];

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Page shown on the mobile menu button */
  protected readonly current = computed(() => this.items.find((item) => this.url().startsWith(item.path)));

  /** Shape under the current page; none when the page is not in the menu (or on phones) */
  protected readonly place = signal<Place | null>(null);
  /** Way of its last move: the edge on that side leads */
  protected readonly direction = signal<'left' | 'right'>('right');
  /** Number of moves: its parity restarts the stretch animation */
  protected readonly moves = signal(0);
  /** Moves are animated once the fonts are loaded (not while the pills get their final width) */
  protected readonly animated = signal(false);
  private placedIndex = -1;

  constructor() {
    // Under the current page after each change of page
    afterRenderEffect(() => {
      this.current();
      untracked(() => this.placeShape());
    });

    // ...and as the pills change size: language, badge count, fonts loaded, window resized
    afterNextRender(() => {
      const bar = this.bar()?.nativeElement;
      if (!bar) return;
      const observer = new ResizeObserver(() => this.placeShape());
      observer.observe(bar);
      bar.querySelectorAll('.pill').forEach((pill) => observer.observe(pill));
      this.destroyRef.onDestroy(() => observer.disconnect());
      document.fonts.ready.then(() => requestAnimationFrame(() => this.animated.set(true)));
    });
  }

  private placeShape(): void {
    const bar = this.bar()?.nativeElement;
    const index = this.items.findIndex((item) => item === this.current());
    const pill = index < 0 ? undefined : bar?.querySelectorAll<HTMLElement>('.pill')[index];
    // Hidden bar (phones): nothing to place
    if (!bar || !pill || !pill.offsetWidth) {
      this.place.set(null);
      this.placedIndex = -1;
      return;
    }

    const next: Place = { left: pill.offsetLeft, right: bar.clientWidth - pill.offsetLeft - pill.offsetWidth };
    const previous = this.place();
    if (previous && previous.left === next.left && previous.right === next.right) return;

    // Another page (not the same pill getting wider): the shape flows to it
    if (previous && this.placedIndex >= 0 && index !== this.placedIndex) {
      this.direction.set(index > this.placedIndex ? 'right' : 'left');
      this.moves.update((n) => n + 1);
    }
    this.placedIndex = index;
    this.place.set(next);
  }
}
