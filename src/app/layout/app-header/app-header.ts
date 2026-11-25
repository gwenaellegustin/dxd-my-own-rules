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
import { UndoService } from '../../core/services/undo.service';

/** Navigation API (Chromium): tells whether there is a page to go back / forward to */
interface NavigationHistory {
  canGoBack: boolean;
  canGoForward: boolean;
}

const navigationHistory = (): NavigationHistory | undefined =>
  (globalThis as { navigation?: NavigationHistory }).navigation;

/** One square of the liquid checkerboard (px, from the right end of the header's free space) */
interface FlagSquare {
  x: number;
  y: number;
  size: number;
}

/**
 * Squares of the liquid checkerboard of the header: whole on the right, where the filter of the
 * template joins them at their corners, then smaller and smaller towards the left, where they
 * round off into separate drops and disappear: a checkered flag melting.
 */
function liquidFlag(): FlagSquare[] {
  const cell = 16; // 4 rows in the header
  const rows = 4;
  const columns = 40;
  const squares: FlagSquare[] = [];
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      if ((row + column) % 2) continue;
      // Slightly uneven sizes (always the same), so the drops do not look lined up
      const jitter = (((column * 7 + row * 13) % 5) - 2) * 0.05;
      const scale = Math.min(1.08, 1.15 - column * 0.032 + jitter);
      const size = cell * scale;
      if (size < 3) continue;
      squares.push({
        x: -(column + 0.5) * cell - size / 2,
        y: (row + 0.5) * cell - size / 2,
        size: Math.round(size * 10) / 10,
      });
    }
  }
  return squares;
}

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

  protected readonly flagSquares = liquidFlag();

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
