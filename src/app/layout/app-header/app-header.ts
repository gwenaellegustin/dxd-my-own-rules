import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
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
import { UndoService } from '../../core/services/undo.service';
import { readPreference, writePreference } from '../../core/utils/local-storage';

/** Navigation API (Chromium): tells whether there is a page to go back / forward to */
interface NavigationHistory {
  canGoBack: boolean;
  canGoForward: boolean;
}

const navigationHistory = (): NavigationHistory | undefined =>
  (globalThis as { navigation?: NavigationHistory }).navigation;

/**
 * Header: the pages and back / forward (browser history) on the left; undo / redo (edits of the
 * whole app, also Ctrl+Z / Ctrl+Y) and the user menu (company logo: settings, language) on the right.
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
  protected readonly history = inject(UndoService);
  protected readonly location = inject(Location);

  /** Without the Navigation API (Firefox, Safari) the buttons stay enabled */
  protected readonly canGoBack = signal(true);
  protected readonly canGoForward = signal(true);

  /**
   * TEMPORARY, to compare: brushed steel texture shown or not (class .no-texture on <html>, see
   * styles.scss), remembered in this browser
   */
  protected readonly texture = signal(readPreference('texture') !== 'off');

  protected toggleTexture(): void {
    this.texture.update((shown) => !shown);
    writePreference('texture', this.texture() ? null : 'off');
  }

  constructor() {
    effect(() => document.documentElement.classList.toggle('no-texture', !this.texture()));

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
