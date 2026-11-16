import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { Icon, IconName } from '../../shared/icon/icon';
import { ShoppingListService } from '../../core/services/shopping-list.service';

interface NavItem {
  path: string;
  labelKey: string;
  icon: IconName;
  badge?: () => number;
}

/**
 * Main navigation of the header: icon + name pills; on mobile a button showing the current page
 * opens a menu with every page.
 */
@Component({
  selector: 'app-main-nav',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, TranslatePipe, Icon],
  templateUrl: './main-nav.html',
  styleUrl: './main-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOutside($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
})
export class MainNav {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly shoppingList = inject(ShoppingListService);

  protected readonly items: NavItem[] = [
    { path: '/worksheets', labelKey: 'nav.worksheet', icon: 'tool' },
    { path: '/invoices', labelKey: 'nav.invoice', icon: 'invoice' },
    { path: '/clients', labelKey: 'nav.clients', icon: 'person' },
    { path: '/shopping-list', labelKey: 'nav.shoppingList', icon: 'cart', badge: () => this.shoppingList.count() },
  ];

  protected readonly menuOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Page shown on the mobile menu button */
  protected readonly current = computed(() => this.items.find((item) => this.url().startsWith(item.path)));

  /** Something to see in the menu (shown on the closed mobile button) */
  protected readonly hasBadge = computed(() => this.items.some((item) => (item.badge?.() ?? 0) > 0));

  protected closeOutside(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.menuOpen.set(false);
  }
}
