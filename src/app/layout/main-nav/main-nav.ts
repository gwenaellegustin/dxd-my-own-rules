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

/** Place of the pill of the current page in the bar (px) */
interface Place {
  left: number;
  width: number;
}

/**
 * Main navigation of the header: icon + name pills; on mobile a button showing the current page
 * opens a menu with every page.
 *
 * The black capsule under the current page is made of two drops on the same place. When the page
 * changes they flow to the new pill, the front one quicker: while they are close a filter keeps
 * them joined by a neck (metaball), further apart they split, then they merge again.
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

  /** Pill of the current page; none when the page is not in the menu (or on phones) */
  protected readonly place = signal<Place | null>(null);
  /** The drops flow once the fonts are loaded (not while the pills get their final width) */
  protected readonly animated = signal(false);

  constructor() {
    // Under the current page after each change of page
    afterRenderEffect(() => {
      this.current();
      untracked(() => this.placeDrops());
    });

    // ...and as the pills change size: language, badge count, fonts loaded, window resized
    afterNextRender(() => {
      const bar = this.bar()?.nativeElement;
      if (!bar) return;
      const observer = new ResizeObserver(() => this.placeDrops());
      observer.observe(bar);
      bar.querySelectorAll('.pill').forEach((pill) => observer.observe(pill));
      this.destroyRef.onDestroy(() => observer.disconnect());
      document.fonts.ready.then(() => requestAnimationFrame(() => this.animated.set(true)));
    });
  }

  private placeDrops(): void {
    const bar = this.bar()?.nativeElement;
    const index = this.items.findIndex((item) => item === this.current());
    const pill = index < 0 ? undefined : bar?.querySelectorAll<HTMLElement>('.pill')[index];
    // Hidden bar (phones): nothing to place
    if (!pill?.offsetWidth) {
      this.place.set(null);
      return;
    }
    const next: Place = { left: pill.offsetLeft, width: pill.offsetWidth };
    const previous = this.place();
    if (previous?.left !== next.left || previous.width !== next.width) this.place.set(next);
  }
}
