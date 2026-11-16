import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Location, UpperCasePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { LanguageService } from '../../core/services/language.service';
import { MainNav } from '../main-nav/main-nav';
import { Dropdown } from '../../shared/dropdown/dropdown';
import { UserService } from '../../core/services/user.service';
import { WorksheetStore } from '../../core/services/worksheet.store';

/** Navigation API (Chromium): tells whether there is a page to go back / forward to */
interface NavigationHistory {
  canGoBack: boolean;
  canGoForward: boolean;
}

const navigationHistory = (): NavigationHistory | undefined =>
  (globalThis as { navigation?: NavigationHistory }).navigation;

/**
 * Header: logo and the pages on the left; back / forward (browser history), undo / redo
 * (worksheet edits, also Ctrl+Z / Ctrl+Y) and the user menu (settings, language) on the right.
 */
@Component({
  selector: 'app-header',
  imports: [UpperCasePipe, RouterLink, TranslatePipe, Icon, MainNav, Dropdown],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {
  protected readonly user = inject(UserService);
  protected readonly language = inject(LanguageService);
  protected readonly worksheets = inject(WorksheetStore);
  protected readonly location = inject(Location);

  /** Without the Navigation API (Firefox, Safari) the buttons stay enabled */
  protected readonly canGoBack = signal(true);
  protected readonly canGoForward = signal(true);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const history = navigationHistory();
        if (!history) return;
        this.canGoBack.set(history.canGoBack);
        this.canGoForward.set(history.canGoForward);
      });
  }
}
