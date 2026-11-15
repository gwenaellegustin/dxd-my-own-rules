import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { LanguageService } from '../../core/services/language.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { UserService } from '../../core/services/user.service';

interface NavItem {
  path: string;
  labelKey: string;
  badge?: () => number;
}

@Component({
  selector: 'app-header',
  imports: [UpperCasePipe, RouterLink, RouterLinkActive, TranslatePipe, Icon],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeMenuOnOutsideClick($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
})
export class AppHeader {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly shoppingList = inject(ShoppingListService);
  protected readonly user = inject(UserService);
  protected readonly language = inject(LanguageService);

  protected readonly menuOpen = signal(false);

  protected readonly navItems: NavItem[] = [
    { path: '/worksheets', labelKey: 'nav.worksheet' },
    { path: '/invoices', labelKey: 'nav.invoice' },
    { path: '/clients', labelKey: 'nav.clients' },
    { path: '/shopping-list', labelKey: 'nav.shoppingList', badge: () => this.shoppingList.count() },
  ];

  protected closeMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.menuOpen.set(false);
  }
}
